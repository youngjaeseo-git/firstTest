#!/bin/bash
# [38.100에서 실행] DB 체인 수정 + 앱 재시작

set -e
cd "$(dirname "$0")/../.."
export PATH=$HOME/opt/node-20/bin:$PATH

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 끊긴 8대 확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT hostname || ' | rackId=' || COALESCE(\"rackId\", 'NULL')
   FROM \"Equipment\"
   WHERE \"bmcIpAddress\" IS NOT NULL
     AND (\"rackId\" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM \"Rack\" r
         JOIN \"Room\" rm ON r.\"roomId\" = rm.id
         WHERE r.id = \"Equipment\".\"rackId\" AND rm.\"bmcProxyUrl\" IS NOT NULL
       ))
   LIMIT 10;"

echo ""
echo "=== 2. rackId NULL인 장비 → 기본 Rack 할당 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -c \
  "UPDATE \"Equipment\"
   SET \"rackId\" = 'rack-lab3-default', \"updatedAt\" = NOW()
   WHERE \"bmcIpAddress\" IS NOT NULL
     AND \"rackId\" IS NULL
     AND \"ipAddress\" LIKE '10.144.131.%';"

echo ""
echo "=== 3. 수정 후 체인 재확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT '완전=' || count(*) FROM \"Equipment\" e
   JOIN \"Rack\" r ON e.\"rackId\" = r.id
   JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"bmcIpAddress\" IS NOT NULL AND rm.\"bmcProxyUrl\" IS NOT NULL;"
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT '끊김=' || count(*) FROM \"Equipment\"
   WHERE \"bmcIpAddress\" IS NOT NULL
     AND (\"rackId\" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM \"Rack\" r JOIN \"Room\" rm ON r.\"roomId\" = rm.id
         WHERE r.id = \"Equipment\".\"rackId\" AND rm.\"bmcProxyUrl\" IS NOT NULL));"

echo ""
echo "=== 4. Prisma migrate + generate ==="
REAL_PASSWORD=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
REAL_PORT=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
export DATABASE_URL="postgresql://dcim:${REAL_PASSWORD:-dcim_password}@localhost:${REAL_PORT:-5432}/dcim?schema=public"
npx prisma migrate deploy 2>&1 || echo "변경 없음"
npx prisma generate 2>&1 | tail -1

echo ""
echo "=== 5. 앱 재시작 ==="
pkill -f "next dev" 2>/dev/null && echo "기존 종료" || echo "실행중 없음"
sleep 2
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dcim-nextauth-secret-$(hostname)}"
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://${SERVER_IP:-localhost}:3000}"
nohup npm run dev -- -p 3000 > /tmp/dcim-app.log 2>&1 &
echo "PID: $!"

echo ""
echo "=== 6. 앱 기동 확인 (15초) ==="
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000 2>/dev/null)
  if [ "$CODE" = "200" ] || [ "$CODE" = "302" ] || [ "$CODE" = "307" ]; then
    echo "앱 OK (HTTP $CODE)"
    break
  fi
  if [ "$i" -eq 15 ]; then echo "아직 시작 안됨. tail -f /tmp/dcim-app.log"; fi
  sleep 1
done
