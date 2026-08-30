from http.server import BaseHTTPRequestHandler
from backend.security import handle_options, public_user, require_user, send_json

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, 'GET, OPTIONS')

    def do_GET(self):
        user = require_user(self)
        if not user:
            return
        send_json(self, 200, {'ok': True, 'user': public_user(user)})
