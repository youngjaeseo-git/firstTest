#!/bin/bash
# BMC 프록시 배포 (Lab-3 마스터 131.100에서 실행)
# ★★★ Lab-3 마스터(131.100)에서 실행 ★★★

set -e

echo "=== BMC 프록시 배포 ==="

# 1. 파일 복사
echo "-- 1. 프록시 스크립트 설치 --"
mkdir -p /opt/bmc-proxy
cp "$(dirname "$0")/../../k8s/bmc-proxy/bmc-proxy.py" /opt/bmc-proxy/bmc-proxy.py
chmod +x /opt/bmc-proxy/bmc-proxy.py
echo "OK: /opt/bmc-proxy/bmc-proxy.py"

# 2. systemd 서비스 등록
echo "-- 2. systemd 서비스 등록 --"
cp "$(dirname "$0")/../../k8s/bmc-proxy/bmc-proxy.service" /etc/systemd/system/bmc-proxy.service
systemctl daemon-reload
systemctl enable bmc-proxy
systemctl restart bmc-proxy
echo "OK: bmc-proxy.service 등록 및 시작"

# 3. 상태 확인
echo ""
echo "-- 3. 서비스 상태 --"
systemctl status bmc-proxy --no-pager -l | head -10

# 4. 포트 확인
echo ""
echo "-- 4. 포트 확인 --"
sleep 1
ss -tlnp | grep 8443 | head -1 || echo "8443 포트 미사용 (시작 실패?)"

# 5. 로컬 테스트
echo ""
echo "-- 5. 로컬 테스트 --"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://localhost:8443/bmc-proxy/192.168.10.103/redfish/v1/" 2>/dev/null)
echo "로컬 프록시 테스트 HTTP: $CODE"

echo ""
echo "=== 완료 ==="
echo "Lab-1에서 테스트: curl -s http://10.144.131.100:8443/bmc-proxy/192.168.10.103/redfish/v1/"
