from http.server import BaseHTTPRequestHandler
from backend.security import handle_options, list_auth_users, read_json, require_user, self_user, send_json, update_auth_user, validate_nickname


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, 'GET, POST, OPTIONS')

    def do_GET(self):
        user = require_user(self)
        if not user:
            return
        send_json(self, 200, {'ok': True, 'user': self_user(user)})

    def do_POST(self):
        user = require_user(self)
        if not user:
            return
        try:
            data = read_json(self, 8 * 1024)
            users = list_auth_users()
            nickname = validate_nickname(user, data.get('nickname'), users)
            metadata = dict(user.get('user_metadata') or {})
            metadata['nickname'] = nickname
            updated = update_auth_user(user.get('id'), {'user_metadata': metadata})
            send_json(self, 200, {'ok': True, 'user': self_user(updated)})
        except ValueError as exc:
            send_json(self, 400, {'ok': False, 'error': str(exc)})
        except Exception:
            send_json(self, 500, {'ok': False, 'error': 'Не вдалося зберегти нік'})
