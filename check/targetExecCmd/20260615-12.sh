#!/bin/bash
# Lab-3 Room bmcProxyUrl 수동 설정 (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)

echo "=== 현재 Room 목록 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT id || ' | ' || name || ' | proxy=' || COALESCE(\"bmcProxyUrl\", 'NULL') FROM \"Room\";"

echo ""
echo "=== Lab-3 Room에 프록시 설정 (이름에 3 포함) ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -c \
  "UPDATE \"Room\" SET \"bmcProxyUrl\" = 'http://10.144.131.100:8443' WHERE name ILIKE '%3%';"

echo ""
echo "=== 설정 후 확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT name || ' : ' || COALESCE(\"bmcProxyUrl\", 'NULL') FROM \"Room\";"
