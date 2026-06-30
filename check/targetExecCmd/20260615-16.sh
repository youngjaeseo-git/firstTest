#!/bin/bash
# DCIM 앱 재빌드 + BMC 프록시 동작 확인 (38.100에서 실행)

set -e
cd "$(dirname "$0")/../.."

echo "=== 1. 최신 코드 pull ==="
git pull origin claude/dcim-management-system-6oyFy
echo "OK"

echo ""
echo "=== 2. Docker 앱 재빌드 ==="
docker compose build app
echo "OK"

echo ""
echo "=== 3. 앱 재시작 ==="
docker compose up -d app
echo "OK"

echo ""
echo "=== 4. 앱 기동 대기 (30초) ==="
sleep 30
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
echo "앱 HTTP: $CODE"

echo ""
echo "=== 5. BMC 프록시 테스트 (131.120 장비) ==="
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
EQ_ID=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT id FROM \"Equipment\" WHERE \"ipAddress\" = '10.144.131.120' LIMIT 1;" 2>/dev/null | tr -d ' ')

if [ -n "$EQ_ID" ]; then
  echo "장비ID: $EQ_ID"
  RESP=$(curl -s -w "\nHTTP:%{http_code}" --connect-timeout 15 \
    "http://localhost:3000/api/equipment/${EQ_ID}/power" \
    -H "Cookie: $(cat /tmp/dcim-cookie 2>/dev/null || echo 'none')" 2>/dev/null)
  echo "$RESP"
else
  echo "장비 없음"
fi

echo ""
echo "=== 완료 ==="
echo "브라우저에서 Lab-3 장비 BMC를 눌러보세요."
