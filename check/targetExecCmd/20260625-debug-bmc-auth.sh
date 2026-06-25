#!/bin/bash
# BMC 인증 진단: .env 자격증명으로 실제 BMC에 curl 테스트
# 실행: bash check/targetExecCmd/20260625-debug-bmc-auth.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

set -a; source .env 2>/dev/null; set +a

echo "=== B1. .env BMC 자격증명 확인 ==="
echo "USER_LEN=${#BMC_USERNAME} PASS_LEN=${#BMC_PASSWORD}"
echo "USER_FIRST3=${BMC_USERNAME:0:3}*** PASS_FIRST2=${BMC_PASSWORD:0:2}***"

echo "=== B2. K8s pod 환경변수 비교 ==="
POD=$(kubectl get pods -o name 2>/dev/null | grep -i dcim | head -1)
if [ -n "$POD" ]; then
  K_USER=$(kubectl exec $POD -- printenv BMC_USERNAME 2>/dev/null)
  K_PASS=$(kubectl exec $POD -- printenv BMC_PASSWORD 2>/dev/null)
  echo "POD=$POD"
  echo "K_USER_LEN=${#K_USER} K_PASS_LEN=${#K_PASS}"
  echo "MATCH_USER=$([ "$BMC_USERNAME" = "$K_USER" ] && echo 'YES' || echo 'NO')"
  echo "MATCH_PASS=$([ "$BMC_PASSWORD" = "$K_PASS" ] && echo 'YES' || echo 'NO')"
else
  echo "K8s pod 못 찾음. docker 확인..."
  APP_C=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i dcim-app | head -1)
  if [ -n "$APP_C" ]; then
    D_USER=$(docker exec $APP_C printenv BMC_USERNAME 2>/dev/null)
    D_PASS=$(docker exec $APP_C printenv BMC_PASSWORD 2>/dev/null)
    echo "CONTAINER=$APP_C"
    echo "D_USER_LEN=${#D_USER} D_PASS_LEN=${#D_PASS}"
    echo "MATCH_USER=$([ "$BMC_USERNAME" = "$D_USER" ] && echo 'YES' || echo 'NO')"
    echo "MATCH_PASS=$([ "$BMC_PASSWORD" = "$D_PASS" ] && echo 'YES' || echo 'NO')"
  else
    echo "앱 컨테이너/pod 못 찾음"
  fi
fi

echo "=== B3. BMC curl 직접 테스트 (첫 BMC IP) ==="
BMC_IP=$(docker exec $(docker compose ps -q db 2>/dev/null) psql -U dcim -d dcim -t -A -c "SELECT \"bmcIpAddress\" FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NOT NULL ORDER BY hostname LIMIT 1;" 2>/dev/null)
if [ -n "$BMC_IP" ]; then
  echo "TARGET=$BMC_IP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -k -u "$BMC_USERNAME:$BMC_PASSWORD" --connect-timeout 5 "https://$BMC_IP/redfish/v1/Systems" 2>/dev/null)
  echo "HTTPS_STATUS=$HTTP"
  if [ "$HTTP" = "000" ]; then
    HTTP2=$(curl -s -o /dev/null -w "%{http_code}" -k -u "$BMC_USERNAME:$BMC_PASSWORD" --connect-timeout 5 "http://$BMC_IP/redfish/v1/Systems" 2>/dev/null)
    echo "HTTP_STATUS=$HTTP2"
  fi
else
  echo "DB에서 BMC IP 조회 실패"
fi

echo "=== 완료 ==="
