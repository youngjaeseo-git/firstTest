#!/bin/bash
# 131.121 BMC 프록시 체인 진단 (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 장비 체인 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT 'rack=' || COALESCE(r.name,'NULL') || ' | room=' || COALESCE(rm.name,'NULL') || ' | proxy=' || COALESCE(rm.\"bmcProxyUrl\",'NULL')
   FROM \"Equipment\" e
   LEFT JOIN \"Rack\" r ON e.\"rackId\" = r.id
   LEFT JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"bmcIpAddress\" = '192.168.10.121';"

echo "=== 2. rackId 값 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT 'rackId=' || COALESCE(e.\"rackId\",'NULL')
   FROM \"Equipment\" e WHERE e.\"bmcIpAddress\" = '192.168.10.121';"
