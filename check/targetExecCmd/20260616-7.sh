#!/bin/bash
# proxyUrl이 실제로 전달되는지 확인 (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 192.168.10.213 장비 체인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT e.hostname || ' | ip=' || e.\"ipAddress\" || ' | rackId=' || COALESCE(e.\"rackId\",'NULL') || ' | bmcIp=' || COALESCE(e.\"bmcIpAddress\",'NULL')
   FROM \"Equipment\" e WHERE e.\"bmcIpAddress\" = '192.168.10.213';"

echo ""
echo "=== 2. 해당 장비의 Rack→Room→proxy 체인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT 'rack=' || COALESCE(r.name,'NULL') || ' | roomId=' || COALESCE(r.\"roomId\",'NULL') || ' | room=' || COALESCE(rm.name,'NULL') || ' | proxy=' || COALESCE(rm.\"bmcProxyUrl\",'NULL')
   FROM \"Equipment\" e
   LEFT JOIN \"Rack\" r ON e.\"rackId\" = r.id
   LEFT JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"bmcIpAddress\" = '192.168.10.213';"

echo ""
echo "=== 3. 현재 git 브랜치 ==="
git branch --show-current

echo ""
echo "=== 4. redfish.ts에 proxyUrl 있는지 ==="
grep -c "proxyUrl" src/lib/redfish.ts

echo ""
echo "=== 5. sensors/route.ts에 bmcProxyUrl 있는지 ==="
grep -c "bmcProxyUrl" src/app/api/equipment/*/sensors/route.ts 2>/dev/null

echo ""
echo "=== 6. Prisma Client에 bmcProxyUrl 있는지 ==="
grep -c "bmcProxyUrl" node_modules/.prisma/client/index.js 2>/dev/null
