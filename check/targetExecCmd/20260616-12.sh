#!/bin/bash
# Lab-2 Room 존재 확인 + 없으면 생성 (38.100에서 실행)

cd "$(dirname "$0")/../.."
DB=$(docker compose ps -q db 2>/dev/null)

echo "=== 1. 전체 Room 목록 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT name || ' | id=' || id || ' | layout=' || COALESCE(\"layoutX\"::text,'NULL') || ',' || COALESCE(\"layoutY\"::text,'NULL') || ',' || COALESCE(\"layoutW\"::text,'NULL') || ',' || COALESCE(\"layoutH\"::text,'NULL') FROM \"Room\" ORDER BY name;"

echo "=== 2. Lab-2 존재 여부 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT CASE WHEN EXISTS(SELECT 1 FROM \"Room\" WHERE name ILIKE '%lab%2%' OR name ILIKE '%lab-2%') THEN 'EXISTS' ELSE 'NOT_FOUND' END;"

echo "=== 3. Lab-2 없으면 생성 ==="
docker exec "$DB" psql -U dcim -d dcim -c \
  "INSERT INTO \"Room\" (id, name, \"dataCenterId\", \"layoutX\", \"layoutY\", \"layoutW\", \"layoutH\")
   SELECT 'room-lab2', 'LAB-2',
     (SELECT id FROM \"DataCenter\" LIMIT 1),
     12, 345, 665, 293
   WHERE NOT EXISTS (SELECT 1 FROM \"Room\" WHERE name ILIKE '%lab%2%' OR name ILIKE '%lab-2%');"

echo "=== 4. 결과 확인 ==="
docker exec "$DB" psql -U dcim -d dcim -t -c \
  "SELECT name || ' | id=' || id FROM \"Room\" ORDER BY name;"
