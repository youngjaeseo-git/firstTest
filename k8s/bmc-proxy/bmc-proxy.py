#!/usr/bin/env python3
"""BMC Reverse Proxy — Lab-3 master (10.144.131.100)에서 실행.

DCIM 앱(Lab-1)이 Lab-3 BMC(192.168.10.x)에 접근할 수 없으므로,
이 프록시가 HTTP 요청을 받아 HTTPS로 BMC에 전달한다.

URL 형식: GET/POST http://thishost:8443/bmc-proxy/{bmc_ip}/{redfish_path}
예: GET http://10.144.131.100:8443/bmc-proxy/192.168.10.103/redfish/v1/Systems

접근 제한: ALLOWED_CLIENTS에 등록된 IP만 허용.
"""

import http.server
import urllib.request
import ssl
import sys
import os
import json
from datetime import datetime

PORT = int(os.environ.get("BMC_PROXY_PORT", "8443"))
ALLOWED_CLIENTS = os.environ.get("BMC_PROXY_ALLOWED", "10.144.38.100").split(",")
BMC_TIMEOUT = int(os.environ.get("BMC_PROXY_TIMEOUT", "15"))


class BmcProxyHandler(http.server.BaseHTTPRequestHandler):
    def _check_access(self):
        client_ip = self.client_address[0]
        if ALLOWED_CLIENTS and ALLOWED_CLIENTS[0] and client_ip not in ALLOWED_CLIENTS:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(f"Forbidden: {client_ip}".encode())
            return False
        return True

    def _proxy(self, method):
        if not self._check_access():
            return

        parts = self.path.split("/", 3)
        if len(parts) < 4 or parts[1] != "bmc-proxy":
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Usage: /bmc-proxy/{bmc_ip}/{path}")
            return

        bmc_ip = parts[2]
        bmc_path = "/" + parts[3]
        url = "https://" + bmc_ip + bmc_path

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(url, method=method)
        auth = self.headers.get("Authorization", "")
        if auth:
            req.add_header("Authorization", auth)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")

        body = None
        content_len = self.headers.get("Content-Length")
        if content_len:
            body = self.rfile.read(int(content_len))
            req.data = body

        try:
            resp = urllib.request.urlopen(req, timeout=BMC_TIMEOUT, context=ctx)
            data = resp.read()
            self.send_response(resp.getcode())
            self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            body_bytes = e.read() if hasattr(e, "read") else b""
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body_bytes)
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        self._proxy("GET")

    def do_POST(self):
        self._proxy("POST")

    def do_PATCH(self):
        self._proxy("PATCH")

    def log_message(self, fmt, *args):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        client = self.client_address[0]
        print(f"[{ts}] {client} {args[0] if args else ''}")


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), BmcProxyHandler)
    print(f"BMC Proxy started on :{PORT}")
    print(f"Allowed clients: {ALLOWED_CLIENTS}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()
