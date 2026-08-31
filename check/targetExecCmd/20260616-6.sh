#!/bin/bash
# 131.119 / 131.200 개별 체인 확인 (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)

echo "=== 131.119 체인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT e.hostname || ' | rack=' || COALESCE(r.name,'NULL') || ' | room=' || COALESCE(rm.name,'NULL') || ' | proxy=' || COALESCE(rm.\"bmcProxyUrl\",'NULL') || ' | bmcIp=' || COALESCE(e.\"bmcIpAddress\",'NULL')
   FROM \"Equipment\" e
   LEFT JOIN \"Rack\" r ON e.\"rackId\" = r.id
   LEFT JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"ipAddress\" = '10.144.131.119';"

echo ""
echo "=== 131.200 체인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT e.hostname || ' | rack=' || COALESCE(r.name,'NULL') || ' | room=' || COALESCE(rm.name,'NULL') || ' | proxy=' || COALESCE(rm.\"bmcProxyUrl\",'NULL') || ' | bmcIp=' || COALESCE(e.\"bmcIpAddress\",'NULL')
   FROM \"Equipment\" e
   LEFT JOIN \"Rack\" r ON e.\"rackId\" = r.id
   LEFT JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"ipAddress\" = '10.144.131.200';"

echo ""
echo "=== 여전히 끊긴 장비 목록 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT e.hostname || ' | ip=' || e.\"ipAddress\" || ' | rackId=' || COALESCE(e.\"rackId\",'NULL') || ' | bmcIp=' || COALESCE(e.\"bmcIpAddress\",'NULL')
   FROM \"Equipment\" e
   WHERE e.\"bmcIpAddress\" IS NOT NULL
     AND (e.\"rackId\" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM \"Rack\" r JOIN \"Room\" rm ON r.\"roomId\" = rm.id
         WHERE r.id = e.\"rackId\" AND rm.\"bmcProxyUrl\" IS NOT NULL));"
