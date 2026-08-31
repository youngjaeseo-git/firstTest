#!/bin/bash
# Lab-3 기본 Rack 생성 + 장비 할당 (38.100에서 실행)
# ★★★ BMC 프록시가 동작하려면 Equipment→Rack→Room 연결 필요 ★★★

set -e
cd "$(dirname "$0")/../.."

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then
  echo "DB 컨테이너 없음"
  exit 1
fi

echo "=== 1. Lab-3 Room ID 확인 ==="
ROOM_ID=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT id FROM \"Room\" WHERE name ILIKE '%3%' LIMIT 1;" 2>/dev/null | tr -d ' ')
echo "Room ID: $ROOM_ID"

if [ -z "$ROOM_ID" ]; then
  echo "Lab-3 Room 없음"
  exit 1
fi

echo ""
echo "=== 2. Lab-3 기본 Rack 생성 (없으면) ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -c \
  "INSERT INTO \"Rack\" (id, name, \"totalUnits\", \"roomId\", \"sortOrder\", \"createdAt\", \"updatedAt\")
   SELECT 'rack-lab3-default', 'Lab-3-Default', 48, '$ROOM_ID', 0, NOW(), NOW()
   WHERE NOT EXISTS (SELECT 1 FROM \"Rack\" WHERE id = 'rack-lab3-default');"
echo "OK"

echo ""
echo "=== 3. Lab-3 장비를 기본 Rack에 할당 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -c \
  "UPDATE \"Equipment\"
   SET \"rackId\" = 'rack-lab3-default', \"updatedAt\" = NOW()
   WHERE \"ipAddress\" LIKE '10.144.131.%'
     AND (\"rackId\" IS NULL);"
echo "OK"

echo ""
echo "=== 4. 결과 확인 ==="
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT count(*) || '대 Rack 할당됨' FROM \"Equipment\"
   WHERE \"ipAddress\" LIKE '10.144.131.%' AND \"rackId\" IS NOT NULL;"

echo ""
echo "-- 프록시 체인 검증 (1대 샘플) --"
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c \
  "SELECT e.hostname || ' → Rack=' || r.name || ' → Room=' || rm.name || ' → proxy=' || COALESCE(rm.\"bmcProxyUrl\", 'NULL')
   FROM \"Equipment\" e
   JOIN \"Rack\" r ON e.\"rackId\" = r.id
   JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"ipAddress\" = '10.144.131.120';"

echo ""
echo "=== 완료 ==="
echo "이제 DCIM에서 Lab-3 장비 BMC를 다시 눌러보세요."
