#!/bin/bash
# BMC 프록시 end-to-end 검증 (38.100에서 실행)
# ★★★ Lab-1(38.100)에서 실행 ★★★

echo "=== BMC 프록시 동작 검증 ==="

echo ""
echo "-- 1. 프록시 포트 접근 --"
nc -z -w3 10.144.131.100 8443 2>/dev/null && echo "8443 OK" || echo "8443 FAIL (프록시 미실행)"

echo ""
echo "-- 2. 프록시 경유 BMC Redfish --"
CODE=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 5 \
  "http://10.144.131.100:8443/bmc-proxy/192.168.10.103/redfish/v1/" 2>/dev/null)
echo "프록시→BMC HTTP: $CODE"

echo ""
echo "-- 3. DCIM API로 Lab-3 장비 BMC 테스트 --"
cd "$(dirname "$0")/../.."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
EQ_ID=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT id FROM \"Equipment\" WHERE \"ipAddress\" = '10.144.131.103' LIMIT 1;" 2>/dev/null | tr -d ' ')

if [ -n "$EQ_ID" ]; then
  echo "장비 ID: $EQ_ID"
  API_CODE=$(curl -s -o /tmp/bmc-verify.txt -w "%{http_code}" --connect-timeout 10 \
    "http://localhost:3000/api/equipment/${EQ_ID}/sensors" 2>/dev/null)
  echo "DCIM API /sensors HTTP: $API_CODE"
  if [ "$API_CODE" = "200" ]; then
    echo "성공! 온도 센서 수: $(grep -o '"name"' /tmp/bmc-verify.txt 2>/dev/null | wc -l)"
  elif [ "$API_CODE" = "401" ]; then
    echo "인증 필요 (로그인 세션 없음 - 브라우저에서 확인)"
  else
    head -c 200 /tmp/bmc-verify.txt 2>/dev/null
  fi
  rm -f /tmp/bmc-verify.txt
else
  echo "DB에 131.103 장비 없음"
fi

echo ""
echo "=== 요약 ==="
echo "2번이 200이면 프록시 정상. 3번은 로그인 필요할 수 있으므로 브라우저에서도 확인."
