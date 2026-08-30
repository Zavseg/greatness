import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler
from backend.security import handle_options, read_json, require_user, send_json

DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxMPU6k6jUcO6Qs_A59eyDKOTagyArV_Gxqvma0PBrCVwH_0DA6ADV5OvYIFz9jA2Tgyw/exec'


def _gas_url():
    return os.environ.get('GAS_URL') or DEFAULT_GAS_URL


def _gas_service_token():
    token = (os.environ.get('GAS_SERVICE_TOKEN') or '').strip()
    if not token:
        raise RuntimeError('GAS_SERVICE_TOKEN is not configured')
    return token


def _gas_request(action, data):
    payload = {
        'action': action,
        'serviceToken': _gas_service_token(),
    }
    if action == 'upsert':
        payload['entries'] = data.get('entries') if isinstance(data.get('entries'), list) else []
    elif action == 'delete':
        payload['ids'] = data.get('ids') if isinstance(data.get('ids'), list) else []

    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(
        _gas_url(),
        data=body,
        method='POST',
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        return json.loads(response.read().decode('utf-8', errors='replace') or '{}')


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, 'POST, OPTIONS')

    def do_POST(self):
        user = require_user(self, {'contracts', 'admin'})
        if not user:
            return
        try:
            data = read_json(self, 2 * 1024 * 1024)
            action = str(data.get('action') or '').strip().lower()
            if action not in {'list', 'catalog', 'upsert', 'delete'}:
                return send_json(self, 400, {'ok': False, 'error': 'Unsupported contracts action'})
            result = _gas_request(action, data)
            send_json(self, 200 if result.get('ok') else 502, result)
        except ValueError as exc:
            send_json(self, 400, {'ok': False, 'error': str(exc)})
        except Exception:
            send_json(self, 502, {'ok': False, 'error': 'Contracts backend is unavailable'})
