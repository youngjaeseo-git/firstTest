#!/bin/bash
# rackHeight 일괄 변경: SPR(SYS-121H*) 제외 전부 2U (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 현재 rackHeight 분포 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT '1U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=1) || ' | 2U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=2) || ' | etc=' || COUNT(*) FILTER (WHERE \"rackHeight\" NOT IN (1,2)) FROM \"Equipment\";"

echo "=== 2. model별 장비 수 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT COALESCE(model,'NULL') || '=' || COUNT(*) FROM \"Equipment\" GROUP BY model ORDER BY COUNT(*) DESC;"

echo "=== 3. SPR(1U 유지) 대상: model LIKE SYS-121H% ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT COUNT(*) || '대' FROM \"Equipment\" WHERE model LIKE 'SYS-121H%';"

echo "=== 4. 변경 대상 (1U인데 SPR 아닌 장비 수) ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT COUNT(*) FROM \"Equipment\" WHERE \"rackHeight\"=1 AND (model IS NULL OR model NOT LIKE 'SYS-121H%');"

echo "=== 5. 변경 실행 ==="
docker exec "$DB" psql -U dcim -d dcim -c \
  "UPDATE \"Equipment\" SET \"rackHeight\"=2 WHERE \"rackHeight\"=1 AND (model IS NULL OR model NOT LIKE 'SYS-121H%');"

echo "=== 6. 변경 후 분포 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT '1U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=1) || ' | 2U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=2) || ' | etc=' || COUNT(*) FILTER (WHERE \"rackHeight\" NOT IN (1,2)) FROM \"Equipment\";"
