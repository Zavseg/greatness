import json, urllib.parse, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAS_URL = 'https://script.google.com/macros/s/AKfycbxMPU6k6jUcO6Qs_A59eyDKOTagyArV_Gxqvma0PBrCVwH_0DA6ADV5OvYIFz9jA2Tgyw/exec'
VISION_PROXY_TOKEN = 'pJLFPtmR5sSx8PqHcAYUSxF0rPmTG8fV'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != '/api/vision':
            self.send_error(404); return
        try:
            n = int(self.headers.get('Content-Length', '0'))
            payload = json.loads(self.rfile.read(n) or b'{}')
            request_id = 'local_proxy'
            fields = {
                'action': 'vision', 'requestId': request_id, 'proxyMode': 'json', 'proxyToken': VISION_PROXY_TOKEN,
                'imageData': payload.get('imageData',''),
                'detailData': payload.get('detailData','')
            }
            body = urllib.parse.urlencode(fields).encode('utf-8')
            req = urllib.request.Request(GAS_URL, data=body, method='POST', headers={'Content-Type':'application/x-www-form-urlencoded'})
            try:
                with urllib.request.urlopen(req, timeout=195) as r:
                    raw = r.read().decode('utf-8', errors='replace')
            except urllib.error.HTTPError as http_error:
                if http_error.code in (401, 403):
                    raise RuntimeError('Apps Script web app is not public. Deploy this Code.gs as Web app with Who has access = Anyone, then put the new /exec URL into server.py.')
                raise
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                raise RuntimeError('Apps Script returned non-JSON response. Deploy the v1.7.4 Code.gs included in this build.')
            self._json(200 if data.get('ok') else 502, data)
        except Exception as e:
            self._json(502, {'ok': False, 'error': str(e)})

    def _json(self, status, obj):
        raw=json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)

if __name__ == '__main__':
    url='http://127.0.0.1:8767/index.html#contracts'
    print('GREATNESS Contracts v1.9.21 local server')
    print('Serving folder: '+str(ROOT))
    print('GREATNESS local server: '+url)
    print('Keep this window open while using the site. Press Ctrl+C to stop.')
    import threading, webbrowser
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    ThreadingHTTPServer(('127.0.0.1',8767), Handler).serve_forever()
