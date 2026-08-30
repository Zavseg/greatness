import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_ALLOWED_ORIGINS = {
    'https://greatness-two.vercel.app',
    'https://zavseg.github.io',
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


def admin_key_diagnostic():
    url = _supabase_url()
    secret_new = os.environ.get('SUPABASE_SECRET_KEY') or ''
    secret_legacy = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or ''
    secret = secret_new or secret_legacy
    source = 'SUPABASE_SECRET_KEY' if secret_new else ('SUPABASE_SERVICE_ROLE_KEY' if secret_legacy else 'none')
    url_ref = ''
    try:
        url_ref = urllib.parse.urlparse(url).hostname.split('.')[0] if url else ''
    except Exception:
        pass
    info = {
        'source': source,
        'kind': 'sb_secret' if secret.startswith('sb_secret_') else ('jwt' if secret.count('.') == 2 else 'unknown'),
        'length': len(secret),
        'urlRef': url_ref,
    }
    if secret.count('.') == 2:
        try:
            payload = secret.split('.')[1]
            payload += '=' * (-len(payload) % 4)
            claims = json.loads(base64.urlsafe_b64decode(payload.encode('ascii')).decode('utf-8'))
            info['jwtRole'] = claims.get('role')
            info['jwtRef'] = claims.get('ref')
        except Exception:
            info['jwtDecode'] = 'failed'
    return info


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


def public_user(user):
    user = user or {}
    metadata = user.get('user_metadata') or {}
    app = user.get('app_metadata') or {}
    identities = user.get('identities') or []
    provider = app.get('provider') or (identities[0].get('provider') if identities else '') or 'email'
    display = metadata.get('display_name') or metadata.get('full_name') or metadata.get('name') or metadata.get('user_name') or (user.get('email') or '').split('@')[0]
    avatar = metadata.get('avatar_url') or metadata.get('picture') or ''
    return {
        'id': user.get('id'),
        'email': user.get('email') or '',
        'displayName': display,
        'role': role_of(user),
        'provider': provider,
        'avatarUrl': avatar,
        'createdAt': user.get('created_at') or '',
    }


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
