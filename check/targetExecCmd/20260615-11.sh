#!/bin/bash
# Lab-3 BMC IP 일괄 할당 + Room 프록시 설정 (38.100에서 실행)
# ★★★ Lab-1(38.100)에서 실행 ★★★

set -e
cd "$(dirname "$0")/../.."

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then
  echo "DB 컨테이너 없음"
  exit 1
fi

echo "=== 1. Lab-3 Room에 bmcProxyUrl 설정 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -c \
  "UPDATE \"Room\" SET \"bmcProxyUrl\" = 'http://10.144.131.100:8443' WHERE name LIKE '%Lab-3%' OR name LIKE '%lab-3%' OR name LIKE '%lab3%';"
echo "OK"

echo ""
echo "=== 2. Lab-3 장비 BMC IP 일괄 할당 (마지막 옥텟 기반) ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -c \
  "UPDATE \"Equipment\"
   SET \"bmcIpAddress\" = '192.168.10.' || split_part(\"ipAddress\", '.', 4)
   WHERE \"ipAddress\" LIKE '10.144.131.%'
     AND \"bmcIpAddress\" IS NULL;"
echo "OK"

echo ""
echo "=== 3. 결과 확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT count(*) || '대 할당됨' FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' AND \"bmcIpAddress\" IS NOT NULL;"

echo ""
echo "-- 할당 목록 --"
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT hostname || ' | ' || \"ipAddress\" || ' -> BMC ' || \"bmcIpAddress\"
   FROM \"Equipment\"
   WHERE \"ipAddress\" LIKE '10.144.131.%'
   ORDER BY \"ipAddress\";"

echo ""
echo "-- Room 프록시 설정 --"
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT name || ' : ' || COALESCE(\"bmcProxyUrl\", 'NULL') FROM \"Room\";"

echo ""
echo "=== 완료 ==="
echo "안 맞는 BMC IP는 DCIM 사이트에서 장비별로 수정하세요."
