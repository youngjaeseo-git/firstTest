#!/bin/bash
# BMC 프록시 POC 검증 (2단계)
#
# ★ 1단계: Lab-3 마스터(131.100)에서 프록시 실행 ★
#   bash 20260615-9.sh start
#   → 포트 8443에서 프록시 실행됨 (Ctrl+C로 종료)
#
# ★ 2단계: Lab-1(38.100)에서 별도 터미널로 테스트 ★
#   bash 20260615-9.sh test

MODE="${1:-test}"

if [ "$MODE" = "start" ]; then
  echo "=== Lab-3 마스터: BMC 프록시 POC 시작 (포트 8443) ==="
  echo "종료: Ctrl+C"
  echo ""
  python3 -c '
import http.server, urllib.request, ssl, sys

class Proxy(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # URL: /bmc-proxy/192.168.10.x/redfish/v1/...
        parts = self.path.split("/", 3)
        if len(parts) < 4 or parts[1] != "bmc-proxy":
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Usage: /bmc-proxy/BMC_IP/redfish/v1/...")
            return
        bmc_ip = parts[2]
        bmc_path = "/" + parts[3]
        url = "https://" + bmc_ip + bmc_path
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        auth = self.headers.get("Authorization", "")
        req = urllib.request.Request(url)
        if auth:
            req.add_header("Authorization", auth)
        try:
            resp = urllib.request.urlopen(req, timeout=10, context=ctx)
            data = resp.read()
            self.send_response(resp.getcode())
            self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(str(e).encode())
    def log_message(self, fmt, *args):
        print(f"[PROXY] {args[0]}")

print("BMC Proxy listening on :8443")
http.server.HTTPServer(("0.0.0.0", 8443), Proxy).serve_forever()
'

elif [ "$MODE" = "test" ]; then
  echo "=== Lab-1: BMC 프록시 POC 테스트 ==="

  echo ""
  echo "-- 1. 프록시 포트 접근 확인 --"
  nc -z -w3 10.144.131.100 8443 2>/dev/null && echo "8443 OK" || echo "8443 FAIL (프록시가 실행 중인지 확인)"

  echo ""
  echo "-- 2. 프록시 경유 BMC Redfish 호출 --"
  CODE=$(curl -sk -o /tmp/bmc-poc-result.txt -w "%{http_code}" --connect-timeout 5 \
    "http://10.144.131.100:8443/bmc-proxy/192.168.10.103/redfish/v1/" 2>/dev/null)
  echo "프록시 경유 HTTP: $CODE"

  if [ "$CODE" = "200" ]; then
    echo "POC 성공! 응답 미리보기:"
    head -c 200 /tmp/bmc-poc-result.txt 2>/dev/null
    echo ""
  else
    echo "실패. 응답:"
    cat /tmp/bmc-poc-result.txt 2>/dev/null | head -c 300
  fi

  echo ""
  echo "-- 3. 직접 접근과 비교 (Lab-1 BMC) --"
  DIRECT=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 3 \
    "https://192.168.10.103/redfish/v1/" 2>/dev/null)
  echo "직접 접근 HTTP: $DIRECT"

  echo ""
  echo "=== 완료 ==="
  echo "2번이 200이면 프록시 POC 성공 → 본격 구현 진행 가능"
  rm -f /tmp/bmc-poc-result.txt
fi
