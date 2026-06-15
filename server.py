import sys
import os
import subprocess

MIN_PYTHON = (3, 8)

if sys.version_info < MIN_PYTHON:
    print(f'\n  [ERROR] Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+ required (you have {sys.version})')
    print(f'  Download: https://www.python.org/downloads/')
    sys.exit(1)

REQUIRED_PACKAGES = {
    # 'requests': 'requests',
    # 'package_import_name': 'pip_package_name',
}

def ensure_packages():
    missing = []
    for import_name, pip_name in REQUIRED_PACKAGES.items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pip_name)
    if missing:
        print(f'  [*] Installing missing packages: {", ".join(missing)}')
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', *missing])
        print(f'  [*] Done installing packages\n')

ensure_packages()

from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import ssl
import http.cookiejar

HRMS_ORIGIN = 'https://hrms128.thai-nrls.org'
HRMS_BASE = f'{HRMS_ORIGIN}/HRMS11388/Database'
HRMS_LOGIN = f'{HRMS_ORIGIN}/HRMS11388/Account/AuthenUser'
PORT = 5000


def _ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


class ProxyHandler(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy_get()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/login':
            self._handle_login()
        elif self.path.startswith('/api/'):
            self._proxy_post()
        else:
            self.send_error(404)

    def _get_session_id(self):
        return self.headers.get('X-Session-Id', '')

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, message):
        self._send_json({'ResponseStatus': '0', 'ResponseMsg': f'Proxy Error: {message}'}, 500)

    def _handle_login(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ''
            params = urllib.parse.parse_qs(body)
            userid = params.get('userid', [''])[0]
            password = params.get('password', [''])[0]

            if not userid or not password:
                self._send_json({'ResponseStatus': '0', 'ResponseMsg': 'userid and password required'})
                return

            ctx = _ssl_context()

            cj = http.cookiejar.CookieJar()
            opener = urllib.request.build_opener(
                urllib.request.HTTPCookieProcessor(cj),
                urllib.request.HTTPSHandler(context=ctx)
            )
            opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
            opener.open(f'{HRMS_ORIGIN}/HRMS11388/Account/Login')

            session_id = ''
            for cookie in cj:
                if cookie.name == 'ASP.NET_SessionId':
                    session_id = cookie.value
                    break

            if not session_id:
                self._send_json({'ResponseStatus': '0', 'ResponseMsg': 'Cannot get session from HRMS'})
                return

            login_data = urllib.parse.urlencode({
                'userid': userid,
                'password': password,
            }).encode('utf-8')

            req = urllib.request.Request(HRMS_LOGIN, data=login_data, method='POST')
            req.add_header('Cookie', f'ASP.NET_SessionId={session_id}')
            req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
            req.add_header('X-Requested-With', 'XMLHttpRequest')
            req.add_header('User-Agent', 'Mozilla/5.0')
            req.add_header('Accept', 'application/json, */*; q=0.01')
            req.add_header('Origin', HRMS_ORIGIN)
            req.add_header('Referer', f'{HRMS_ORIGIN}/HRMS11388/Account/Login')

            with urllib.request.urlopen(req, context=ctx) as response:
                data = json.loads(response.read().decode('utf-8'))

            data['session_id'] = session_id

            self._send_json(data)

        except Exception as e:
            self._send_error_json(str(e))

    def _proxy_get(self):
        api_path = self.path.replace('/api/', '', 1)
        url = f'{HRMS_BASE}/{api_path}'
        session_id = self._get_session_id()

        try:
            req = urllib.request.Request(url)
            req.add_header('Cookie', f'ASP.NET_SessionId={session_id}')
            req.add_header('X-Requested-With', 'XMLHttpRequest')
            req.add_header('User-Agent', 'Mozilla/5.0')
            req.add_header('Accept', 'application/json, */*; q=0.01')

            with urllib.request.urlopen(req, context=_ssl_context()) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self._send_error_json(str(e))

    def _proxy_post(self):
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
            req.add_header('Accept', 'application/json, */*; q=0.01')
            if 'SaveEmpl' in api_path or 'DeleteEmpl' in api_path:
                req.add_header('Referer', f'{HRMS_ORIGIN}/HRMS11388/Database/EmplList?menuID=00006')
            else:
                req.add_header('Referer', f'{HRMS_ORIGIN}/HRMS11388/Database/UserList?menuID=00015')
            req.add_header('Origin', HRMS_ORIGIN)

            with urllib.request.urlopen(req, context=_ssl_context()) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self._send_error_json(str(e))

    def log_message(self, format, *args):
        print(f'  [{self.log_date_time_string()}] {format % args}')


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print()
    print('=' * 50)
    print('  HRMS Proxy Server')
    print('=' * 50)
    print(f'  Python:  {sys.version.split()[0]}')
    print(f'  Open:    http://localhost:{PORT}')
    print(f'  Stop:    Ctrl+C')
    print('=' * 50)
    print()

    server = HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  [!] Server stopped.')
        server.server_close()
