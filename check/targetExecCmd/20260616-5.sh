#!/bin/bash
# [131.100 Lab-3 마스터에서 실행] BMC 프록시 배포 + 시작

set -e

echo "=== 1. 프록시 디렉토리 생성 ==="
sudo mkdir -p /opt/bmc-proxy

echo ""
echo "=== 2. 프록시 스크립트 생성 ==="
cat > /tmp/bmc-proxy.py << 'PYEOF'
#!/usr/bin/env python3
import http.server, urllib.request, ssl, os, sys

PORT = int(os.environ.get("BMC_PROXY_PORT", "8443"))
ALLOWED = set(os.environ.get("BMC_PROXY_ALLOWED", "10.144.38.100").split(","))
TIMEOUT = int(os.environ.get("BMC_PROXY_TIMEOUT", "15"))

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class H(http.server.BaseHTTPRequestHandler):
    def _proxy(self):
        client = self.client_address[0]
        if client not in ALLOWED:
            self.send_response(403); self.end_headers(); return
        parts = self.path.split("/", 3)
        if len(parts) < 4 or parts[1] != "bmc-proxy":
            self.send_response(400); self.end_headers(); return
        bmc_ip, rest = parts[2], "/" + parts[3]
        url = f"https://{bmc_ip}{rest}"
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection")}
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    if k.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(resp.read())
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(str(e).encode())
    do_GET = do_POST = do_PATCH = _proxy
    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.client_address[0]} {fmt % args}\n")

print(f"BMC Proxy on :{PORT}, allowed={ALLOWED}", flush=True)
http.server.HTTPServer(("0.0.0.0", PORT), H).serve_forever()
PYEOF
sudo cp /tmp/bmc-proxy.py /opt/bmc-proxy/bmc-proxy.py
sudo chmod +x /opt/bmc-proxy/bmc-proxy.py
echo "OK"

echo ""
echo "=== 3. systemd 서비스 등록 ==="
sudo tee /etc/systemd/system/bmc-proxy.service > /dev/null << 'SVCEOF'
[Unit]
Description=BMC Redfish Proxy
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/bmc-proxy/bmc-proxy.py
Environment=BMC_PROXY_PORT=8443
Environment=BMC_PROXY_ALLOWED=10.144.38.100
Environment=BMC_PROXY_TIMEOUT=15
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable bmc-proxy
sudo systemctl restart bmc-proxy
echo "OK"

echo ""
echo "=== 4. 상태 확인 ==="
sleep 2
systemctl is-active bmc-proxy && echo "서비스 실행중" || echo "서비스 FAIL"
ss -tlnp | grep 8443 && echo "8443 포트 OK" || echo "8443 포트 FAIL"

echo ""
echo "=== 5. 로컬 테스트 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://127.0.0.1:8443/bmc-proxy/192.168.10.103/redfish/v1/ 2>/dev/null)
echo "프록시 테스트 HTTP: $CODE"
if [ "$CODE" = "200" ] || [ "$CODE" = "401" ]; then
  echo "프록시 정상!"
else
  echo "확인 필요. journalctl -u bmc-proxy -n 20"
fi
