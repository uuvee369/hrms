"""
HRMS Proxy Server
- เปิด proxy server บนเครื่อง (localhost:5000)
- ส่งต่อ request ไปยัง HRMS API พร้อม Session Cookie
- แก้ปัญหา CORS
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import os
import ssl

HRMS_BASE = 'https://hrms128.thai-nrls.org/HRMS11388/Database'
PORT = 5000

class ProxyHandler(SimpleHTTPRequestHandler):
    """Handle both static files and API proxy requests"""

    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id')
        super().end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        """Proxy GET requests to HRMS API or serve static files"""
        if self.path.startswith('/api/'):
            self._proxy_get()
        else:
            # Serve static files from current directory
            super().do_GET()

    def do_POST(self):
        """Proxy POST requests to HRMS API"""
        if self.path.startswith('/api/'):
            self._proxy_post()
        else:
            self.send_error(404)

    def _get_session_id(self):
        """Get session ID from request header"""
        return self.headers.get('X-Session-Id', '')

    def _proxy_get(self):
        """Forward GET request to HRMS"""
        api_path = self.path.replace('/api/', '', 1)
        url = f'{HRMS_BASE}/{api_path}'
        session_id = self._get_session_id()

        try:
            req = urllib.request.Request(url)
            req.add_header('Cookie', f'ASP.NET_SessionId={session_id}')
            req.add_header('X-Requested-With', 'XMLHttpRequest')
            req.add_header('User-Agent', 'Mozilla/5.0')
            req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')

            # Disable SSL verification (for self-signed certs)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            with urllib.request.urlopen(req, context=ctx) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self._send_error_json(str(e))

    def _proxy_post(self):
        """Forward POST request to HRMS"""
        api_path = self.path.replace('/api/', '', 1)
        url = f'{HRMS_BASE}/{api_path}'
        session_id = self._get_session_id()

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b''

            req = urllib.request.Request(url, data=body, method='POST')
            req.add_header('Cookie', f'ASP.NET_SessionId={session_id}')
            req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
            req.add_header('X-Requested-With', 'XMLHttpRequest')
            req.add_header('User-Agent', 'Mozilla/5.0')
            req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')
            req.add_header('Referer', 'https://hrms128.thai-nrls.org/HRMS11388/Database/UserList?menuID=00015')
            req.add_header('Origin', 'https://hrms128.thai-nrls.org')

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            with urllib.request.urlopen(req, context=ctx) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self._send_error_json(str(e))

    def _send_error_json(self, message):
        """Send error as JSON response"""
        self.send_response(500)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        error = json.dumps({
            'ResponseStatus': '0',
            'ResponseMsg': f'Proxy Error: {message}'
        }, ensure_ascii=False)
        self.wfile.write(error.encode('utf-8'))

    def log_message(self, format, *args):
        """Custom log format"""
        print(f'  [{self.log_date_time_string()}] {format % args}')


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    print()
    print('=' * 50)
    print('  HRMS Proxy Server')
    print('=' * 50)
    print(f'  [*] Open: http://localhost:{PORT}')
    print(f'  [*] Proxy to: {HRMS_BASE}')
    print(f'  [*] Press Ctrl+C to stop')
    print('=' * 50)
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  [!] Server stopped.')
        server.server_close()
