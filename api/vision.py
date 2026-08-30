import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler
from backend.security import handle_options, read_json, require_user, send_json

DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxMPU6k6jUcO6Qs_A59eyDKOTagyArV_Gxqvma0PBrCVwH_0DA6ADV5OvYIFz9jA2Tgyw/exec'


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, 'POST, OPTIONS')

    def do_POST(self):
        user = require_user(self, {'contracts', 'admin'})
        if not user:
            return
        proxy_token = os.environ.get('VISION_PROXY_TOKEN') or os.environ.get('GREATNESS_VISION_PROXY_TOKEN', '')
        gas_url = os.environ.get('GAS_URL') or DEFAULT_GAS_URL
        if not proxy_token:
            return send_json(self, 500, {'ok': False, 'error': 'Vision service is not configured'})
        try:
            incoming = read_json(self, 12 * 1024 * 1024)
            fields = {
                'action': 'vision',
                'requestId': 'secure_proxy',
                'proxyMode': 'json',
                'proxyToken': proxy_token,
                'imageData': incoming.get('imageData', ''),
                'detailData': incoming.get('detailData', '')
            }
            body = urllib.parse.urlencode(fields).encode('utf-8')
            request = urllib.request.Request(gas_url, data=body, method='POST', headers={'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(request, timeout=240) as response:
                raw = response.read().decode('utf-8', errors='replace')
            data = json.loads(raw)
            send_json(self, 200 if data.get('ok') else 502, data)
        except ValueError as exc:
            send_json(self, 400, {'ok': False, 'error': str(exc)})
        except urllib.error.HTTPError as exc:
            send_json(self, 502, {'ok': False, 'error': f'Vision upstream HTTP {exc.code}'})
        except Exception:
            send_json(self, 502, {'ok': False, 'error': 'Vision service is unavailable'})
