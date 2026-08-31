import os
import traceback
from http.server import BaseHTTPRequestHandler
from backend.security import ALLOWED_ROLES, admin_user, anonymous_user_id, handle_options, list_auth_users, read_json, require_user, role_of, send_json, update_auth_user

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, 'GET, POST, OPTIONS')

    def do_GET(self):
        stage = 'require_admin'
        try:
            caller = require_user(self, {'admin'})
            if not caller:
                return

            stage = 'check_server_config'
            has_url = bool(os.environ.get('SUPABASE_URL'))
            has_secret = bool(os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY'))
            if not has_url or not has_secret:
                missing = []
                if not has_url:
                    missing.append('SUPABASE_URL')
                if not has_secret:
                    missing.append('SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
                return send_json(self, 500, {'ok': False, 'error': 'Admin user list is unavailable'})

            stage = 'list_auth_users'
            users = list_auth_users()

            stage = 'serialize_users'
            public_users = [admin_user(user) for user in users]
            send_json(self, 200, {'ok': True, 'users': public_users})
        except Exception:
            traceback.print_exc()
            # Detailed diagnostics stay in server logs only. Never expose backend
            # configuration details, upstream responses, or credential metadata.
            send_json(self, 500, {'ok': False, 'error': 'Admin user list is unavailable'})

    def do_POST(self):
        caller = require_user(self, {'admin'})
        if not caller:
            return
        try:
            data = read_json(self, 32 * 1024)
            public_id = str(data.get('publicId') or '').strip().upper()
            new_role = str(data.get('role') or '').strip().lower()
            if not public_id or new_role not in ALLOWED_ROLES:
                return send_json(self, 400, {'ok': False, 'error': 'Invalid user or role'})
            users = list_auth_users()
            target = next((u for u in users if anonymous_user_id(u) == public_id), None)
            user_id = str(target.get('id')) if target else ''
            if not target:
                return send_json(self, 404, {'ok': False, 'error': 'User not found'})
            if str(caller.get('id')) == user_id and new_role != 'admin':
                return send_json(self, 400, {'ok': False, 'error': 'You cannot remove your own admin access'})
            admin_count = sum(1 for u in users if role_of(u) == 'admin')
            if role_of(target) == 'admin' and new_role != 'admin' and admin_count <= 1:
                return send_json(self, 400, {'ok': False, 'error': 'At least one admin must remain'})
            app_metadata = dict(target.get('app_metadata') or {})
            app_metadata['role'] = new_role
            updated = update_auth_user(user_id, {'app_metadata': app_metadata})
            send_json(self, 200, {'ok': True, 'user': admin_user(updated)})
        except ValueError as exc:
            send_json(self, 400, {'ok': False, 'error': str(exc)})
        except Exception:
            traceback.print_exc()
            send_json(self, 500, {'ok': False, 'error': 'Could not update user role'})
