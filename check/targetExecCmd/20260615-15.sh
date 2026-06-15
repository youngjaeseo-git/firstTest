#!/bin/bash
# BMC 프록시 체인 디버그 — 131.120 장비의 DB 연결 상태 확인 (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 장비 rackId 확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT hostname || ' | rackId=' || COALESCE(\"rackId\", 'NULL') || ' | bmc=' || COALESCE(\"bmcIpAddress\", 'NULL')
   FROM \"Equipment\" WHERE \"ipAddress\" = '10.144.131.120';"

echo ""
echo "=== 2. Lab-3 Rack 존재 여부 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT id || ' | name=' || name || ' | roomId=' || \"roomId\"
   FROM \"Rack\" WHERE id = 'rack-lab3-default' OR name ILIKE '%lab3%' OR name ILIKE '%lab-3%';"

echo ""
echo "=== 3. Room bmcProxyUrl 확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT id || ' | ' || name || ' | proxy=' || COALESCE(\"bmcProxyUrl\", 'NULL') FROM \"Room\";"

echo ""
echo "=== 4. 전체 체인 (131.120) ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT
     'eq=' || e.hostname
     || ' → rack=' || COALESCE(r.name, 'NULL')
     || ' → room=' || COALESCE(rm.name, 'NULL')
     || ' → proxy=' || COALESCE(rm.\"bmcProxyUrl\", 'NULL')
   FROM \"Equipment\" e
   LEFT JOIN \"Rack\" r ON e.\"rackId\" = r.id
   LEFT JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"ipAddress\" = '10.144.131.120';"

echo ""
echo "=== 5. rackId NULL인 Lab-3 장비 수 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT count(*) || '대 rackId=NULL' FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' AND \"rackId\" IS NULL;"
