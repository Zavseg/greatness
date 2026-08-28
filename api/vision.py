import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxMPU6k6jUcO6Qs_A59eyDKOTagyArV_Gxqvma0PBrCVwH_0DA6ADV5OvYIFz9jA2Tgyw/exec'


def _allowed_origin(origin: str) -> str:
    """Return an allowed CORS origin or an empty string.

    Production origin can be overridden with ALLOWED_ORIGIN. Localhost is
    intentionally accepted for development/testing.
    """
    configured = (os.environ.get('ALLOWED_ORIGIN') or 'https://zavseg.github.io').rstrip('/')
    origin = (origin or '').rstrip('/')
    if origin == configured:
        return origin
    if origin.startswith('http://127.0.0.1:') or origin.startswith('http://localhost:'):
        return origin
    return ''


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        origin = _allowed_origin(self.headers.get('Origin', ''))
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        origin = _allowed_origin(self.headers.get('Origin', ''))
        if not origin:
            self._send_json(403, {'ok': False, 'error': 'Origin is not allowed'})
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.send_header('Vary', 'Origin')
        self.end_headers()

    def do_POST(self):
        origin = _allowed_origin(self.headers.get('Origin', ''))
        if not origin:
            self._send_json(403, {'ok': False, 'error': 'Origin is not allowed'})
            return

        proxy_token = os.environ.get('VISION_PROXY_TOKEN') or os.environ.get('GREATNESS_VISION_PROXY_TOKEN', '')
        gas_url = os.environ.get('GAS_URL') or DEFAULT_GAS_URL
        if not proxy_token:
            self._send_json(500, {'ok': False, 'error': 'VISION_PROXY_TOKEN is not configured on the proxy'})
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
            # Contract screenshots are compressed in the browser. Keep a hard cap
            # so the public endpoint cannot be used as an unlimited upload relay.
            if length <= 0 or length > 12 * 1024 * 1024:
                self._send_json(413, {'ok': False, 'error': 'Vision request is empty or too large'})
                return

            incoming = json.loads(self.rfile.read(length) or b'{}')
            fields = {
                'action': 'vision',
                'requestId': 'public_proxy',
                'proxyMode': 'json',
                'proxyToken': proxy_token,
                'imageData': incoming.get('imageData', ''),
                'detailData': incoming.get('detailData', '')
            }
            body = urllib.parse.urlencode(fields).encode('utf-8')
            request = urllib.request.Request(
                gas_url,
                data=body,
                method='POST',
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            with urllib.request.urlopen(request, timeout=55) as response:
                raw = response.read().decode('utf-8', errors='replace')

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                raise RuntimeError('Apps Script returned non-JSON response')

            self._send_json(200 if data.get('ok') else 502, data)
        except urllib.error.HTTPError as exc:
            self._send_json(502, {'ok': False, 'error': f'Apps Script HTTP {exc.code}'})
        except Exception as exc:
            self._send_json(502, {'ok': False, 'error': str(exc)})
