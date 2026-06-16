#!/bin/bash
# rackHeight 일괄 변경: SPR 제외 전부 2U (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 현재 rackHeight 분포 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT '1U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=1) || ' | 2U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=2) || ' | etc=' || COUNT(*) FILTER (WHERE \"rackHeight\" NOT IN (1,2)) FROM \"Equipment\";"

echo "=== 2. SPR 장비 확인 (hostname에 spr 포함) ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT COUNT(*) || '대: ' || string_agg(hostname, ', ' ORDER BY hostname) FROM \"Equipment\" WHERE LOWER(hostname) LIKE '%spr%';"

echo "=== 3. SPR 아닌 1U 장비 수 (변경 대상) ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT COUNT(*) FROM \"Equipment\" WHERE \"rackHeight\"=1 AND (hostname IS NULL OR LOWER(hostname) NOT LIKE '%spr%');"

echo "=== 4. 변경 실행 ==="
docker exec "$DB" psql -U dcim -d dcim -c \
  "UPDATE \"Equipment\" SET \"rackHeight\"=2 WHERE \"rackHeight\"=1 AND (hostname IS NULL OR LOWER(hostname) NOT LIKE '%spr%');"

echo "=== 5. 변경 후 분포 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT '1U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=1) || ' | 2U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=2) || ' | etc=' || COUNT(*) FILTER (WHERE \"rackHeight\" NOT IN (1,2)) FROM \"Equipment\";"
