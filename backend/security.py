import base64
import json
import os
import re
import hashlib
import unicodedata
from difflib import SequenceMatcher
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_ALLOWED_ORIGINS = {
    'https://www.greatness-family.fun',
    'https://greatness-family.fun',
}
ALLOWED_ROLES = {'member', 'contracts', 'admin'}


def allowed_origin(origin: str) -> str:
    origin = (origin or '').rstrip('/')
    configured = os.environ.get('ALLOWED_ORIGIN') or ''
    configured_origins = {item.strip().rstrip('/') for item in configured.split(',') if item.strip()}
    allowed = configured_origins or DEFAULT_ALLOWED_ORIGINS
    if origin in allowed:
        return origin
    if origin.startswith('http://127.0.0.1:') or origin.startswith('http://localhost:'):
        return origin
    return ''


def send_json(handler, status: int, payload, methods='GET, POST, OPTIONS'):
    raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    origin = allowed_origin(handler.headers.get('Origin', ''))
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(raw)))
    handler.send_header('Cache-Control', 'no-store, max-age=0')
    handler.send_header('Pragma', 'no-cache')
    handler.send_header('X-Content-Type-Options', 'nosniff')
    handler.send_header('Referrer-Policy', 'no-referrer')
    handler.send_header('X-Frame-Options', 'DENY')
    handler.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if origin:
        handler.send_header('Access-Control-Allow-Origin', origin)
        handler.send_header('Vary', 'Origin')
    handler.end_headers()
    handler.wfile.write(raw)


def handle_options(handler, methods='GET, POST, OPTIONS'):
    origin = allowed_origin(handler.headers.get('Origin', ''))
    if not origin:
        send_json(handler, 403, {'ok': False, 'error': 'Origin is not allowed'})
        return
    handler.send_response(204)
    handler.send_header('Access-Control-Allow-Origin', origin)
    handler.send_header('Access-Control-Allow-Methods', methods)
    handler.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    handler.send_header('Access-Control-Max-Age', '600')
    handler.send_header('Vary', 'Origin')
    handler.end_headers()


def require_origin(handler):
    origin = (handler.headers.get('Origin') or '').strip()
    # Same-origin GET requests may omit Origin. If Origin is present, enforce the allowlist.
    # Authentication still relies on the Supabase Bearer token; Origin is only an extra browser guard.
    return not origin or bool(allowed_origin(origin))


def read_json(handler, max_bytes=1024 * 1024):
    length = int(handler.headers.get('Content-Length', '0') or 0)
    if length < 0 or length > max_bytes:
        raise ValueError('Request is too large')
    raw = handler.rfile.read(length) if length else b'{}'
    return json.loads(raw or b'{}')


def bearer_token(handler):
    value = handler.headers.get('Authorization', '')
    if not value.lower().startswith('bearer '):
        return ''
    return value.split(' ', 1)[1].strip()


def _supabase_url():
    return (os.environ.get('SUPABASE_URL') or '').rstrip('/')


def _anon_key():
    return os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_PUBLISHABLE_KEY') or ''


def _secret_key():
    return os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or ''


class UpstreamHTTPError(RuntimeError):
    def __init__(self, status, reason, body=''):
        self.status = int(status or 0)
        self.reason = str(reason or '')
        self.body = str(body or '')[:500]
        super().__init__(f'HTTP {self.status}: {self.reason}; body={self.body}')


def request_json(url, *, method='GET', headers=None, body=None, timeout=20):
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode('utf-8', errors='replace')
            return json.loads(raw or '{}')
    except urllib.error.HTTPError as exc:
        try:
            raw = exc.read().decode('utf-8', errors='replace')
        except Exception:
            raw = ''
        raise UpstreamHTTPError(exc.code, exc.reason, raw) from exc


def current_supabase_user(handler):
    token = bearer_token(handler)
    url = _supabase_url()
    anon = _anon_key()
    if not token or not url or not anon:
        return None
    try:
        return request_json(
            f'{url}/auth/v1/user',
            headers={'apikey': anon, 'Authorization': f'Bearer {token}'},
            timeout=15,
        )
    except Exception:
        return None


def role_of(user):
    role = str(((user or {}).get('app_metadata') or {}).get('role') or 'member').lower()
    return role if role in ALLOWED_ROLES else 'member'


def nickname_of(user):
    user = user or {}
    metadata = user.get('user_metadata') or {}
    return str(metadata.get('nickname') or '').strip()


def anonymous_user_id(user):
    raw = str((user or {}).get('id') or '')
    if not raw:
        return 'UNKNOWN'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:12].upper()


def _identity_parts(user):
    user = user or {}
    metadata = user.get('user_metadata') or {}

    email = str(user.get('email') or '').strip().casefold()
    email_local = email.split('@', 1)[0] if '@' in email else email

    given = str(metadata.get('given_name') or '').strip().casefold()
    family = str(metadata.get('family_name') or '').strip().casefold()

    display_values = [
        metadata.get('display_name') or '',
        metadata.get('full_name') or '',
        metadata.get('name') or '',
    ]

    # Google/Supabase do not always expose given_name/family_name. For the
    # common "First Last" format, treat the first token as the given name
    # and the remaining token(s) as family-name data. This lets a player use
    # their real first name as an intentional game nickname while still
    # blocking surname/full-identity and email-derived nicknames.
    if not given or not family:
        for value in display_values:
            tokens = [t for t in re.split(r'[^\w]+', str(value or '').strip().casefold(), flags=re.UNICODE) if t]
            if len(tokens) >= 2:
                if not given:
                    given = tokens[0]
                if not family:
                    family = ''.join(tokens[1:])
                break

    full_compacts = set()
    for value in display_values:
        compact = re.sub(r'[^\w]+', '', str(value or '').strip().casefold(), flags=re.UNICODE).strip('_')
        if len(compact) >= 3:
            full_compacts.add(compact)

    return {
        'email_local': email_local,
        'given_name': given,
        'family_name': family,
        'full_compacts': full_compacts,
    }

def _ascii_fold(value):
    # Comparable form for privacy similarity checks. Normalize both Latin and
    # Ukrainian/Russian spellings so variants like Oleksii / Олексій are caught.
    value = unicodedata.normalize('NFKD', str(value or '').casefold())
    value = ''.join(ch for ch in value if not unicodedata.combining(ch))
    translit = {
        'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ё':'yo','ж':'zh','з':'z',
        'и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
        'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ы':'y',
        'э':'e','ю':'yu','я':'ya','ь':'','ъ':'',
    }
    value = ''.join(translit.get(ch, ch) for ch in value)
    return ''.join(ch for ch in value if ch.isalnum())


def validate_nickname(user, nickname, all_users=None):
    nickname = str(nickname or '').strip()
    if not 3 <= len(nickname) <= 24:
        raise ValueError('Нік має містити від 3 до 24 символів')
    if not re.fullmatch(r'[\w-]+', nickname, flags=re.UNICODE):
        raise ValueError('У ніку дозволені лише літери, цифри, _ та -')
    if '@' in nickname or '.' in nickname:
        raise ValueError('Нік не повинен бути схожим на email')

    candidate = _ascii_fold(nickname)
    if len(candidate) < 3:
        raise ValueError('Нік надто короткий')

    identity_parts = _identity_parts(user)
    given = _ascii_fold(identity_parts.get('given_name'))
    email_local = _ascii_fold(identity_parts.get('email_local'))
    family = _ascii_fold(identity_parts.get('family_name'))

    # A player may intentionally use their real first name as their in-game
    # nickname. Privacy protection targets email, surname and combined real
    # identity - not the first name by itself.
    allowed_first_name = bool(given) and candidate == given

    if email_local and (candidate in email_local or email_local in candidate or SequenceMatcher(None, candidate, email_local).ratio() >= 0.72):
        raise ValueError('Нік не повинен повторювати або бути схожим на ваш email')

    if family and (candidate in family or family in candidate or SequenceMatcher(None, candidate, family).ratio() >= 0.72):
        raise ValueError('Нік не повинен повторювати або бути схожим на ваше прізвище')

    if not allowed_first_name:
        for full_name in identity_parts.get('full_compacts') or set():
            identity = _ascii_fold(full_name)
            if len(identity) < 3:
                continue
            if candidate in identity or identity in candidate or SequenceMatcher(None, candidate, identity).ratio() >= 0.72:
                raise ValueError('Нік не повинен повторювати ваше повне реальне ім’я')

    for other in all_users or []:
        if str(other.get('id') or '') == str(user.get('id') or ''):
            continue
        existing = nickname_of(other)
        if existing and existing.casefold() == nickname.casefold():
            raise ValueError('Цей нік уже зайнятий')
    return nickname


def self_user(user):
    return {
        'nickname': nickname_of(user),
        'hasNickname': bool(nickname_of(user)),
        'role': role_of(user),
        'publicId': anonymous_user_id(user),
        'createdAt': (user or {}).get('created_at') or '',
    }


def admin_user(user):
    return {
        'publicId': anonymous_user_id(user),
        'nickname': nickname_of(user),
        'hasNickname': bool(nickname_of(user)),
        'role': role_of(user),
        'createdAt': (user or {}).get('created_at') or '',
    }


# Backward-compatible serializer name for endpoints that only return the current user.
def public_user(user):
    return self_user(user)


def require_user(handler, roles=None):
    if not require_origin(handler):
        send_json(handler, 403, {'ok': False, 'error': 'Origin is not allowed'})
        return None
    user = current_supabase_user(handler)
    if not user:
        send_json(handler, 401, {'ok': False, 'error': 'Authentication required'})
        return None
    if roles and role_of(user) not in set(roles):
        send_json(handler, 403, {'ok': False, 'error': 'Insufficient access'})
        return None
    return user


def _admin_headers():
    secret = _secret_key()
    if not secret:
        raise RuntimeError('SUPABASE_SECRET_KEY is not configured')

    headers = {
        'apikey': secret,
        'Content-Type': 'application/json',
    }

    # New Supabase secret keys (sb_secret_...) are API keys, not JWTs.
    # Sending them as Authorization: Bearer makes Supabase reject the request with 401.
    # Legacy service_role keys are JWTs and still require the Bearer header.
    if not secret.startswith('sb_secret_'):
        headers['Authorization'] = f'Bearer {secret}'

    return headers


def _admin_url(path=''):
    url = _supabase_url()
    if not url:
        raise RuntimeError('SUPABASE_URL is not configured')
    return f"{url}/auth/v1/admin{path}"


def _user_to_dict(user):
    if isinstance(user, dict):
        return user
    if hasattr(user, 'model_dump'):
        return user.model_dump(mode='json')
    if hasattr(user, 'dict'):
        return user.dict()
    return dict(user or {})


def list_auth_users(per_page=1000):
    query = urllib.parse.urlencode({'page': 1, 'per_page': int(per_page)})
    response = request_json(
        f"{_admin_url('/users')}?{query}",
        headers=_admin_headers(),
        timeout=20,
    )
    if isinstance(response, dict):
        users = response.get('users') or []
    else:
        users = response or []
    return [_user_to_dict(user) for user in users]


def update_auth_user(user_id, body):
    user_id = urllib.parse.quote(str(user_id), safe='')
    response = request_json(
        _admin_url(f'/users/{user_id}'),
        method='PUT',
        headers=_admin_headers(),
        body=body,
        timeout=20,
    )
    user = response.get('user', response) if isinstance(response, dict) else response
    return _user_to_dict(user)
