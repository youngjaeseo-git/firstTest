#!/bin/bash
# Lab-2 Room 존재 확인 + 없으면 생성 (38.100에서 실행)

cd "$(dirname "$0")/../.."

# DB 접근 자동 탐지 (docker-compose / K8s / 로컬 psql)
P=""
DC=$(docker compose ps -q db 2>/dev/null)
if [ -n "$DC" ]; then P="docker exec $DC psql -U dcim -d dcim -t -A"; fi
if [ -z "$P" ]; then
  KP=$(kubectl get pods -A 2>/dev/null | grep -i -E 'postgres|dcim.*db' | head -1)
  if [ -n "$KP" ]; then
    KNS=$(echo "$KP" | awk '{print $1}'); KPOD=$(echo "$KP" | awk '{print $2}')
    P="kubectl exec -n $KNS $KPOD -- psql -U dcim -d dcim -t -A"
  fi
fi
if [ -z "$P" ] && command -v psql &>/dev/null; then
  TEST=$(psql -U dcim -d dcim -t -A -c "SELECT 1;" 2>/dev/null)
  [ "$TEST" = "1" ] && P="psql -U dcim -d dcim -t -A"
fi
if [ -z "$P" ]; then echo "ERR: DB 접근 불가"; exit 1; fi
P_CMD=$(echo "$P" | sed 's/ -t -A//')

echo "=== 1. 전체 Room 목록 ==="
$P -c "SELECT name || ' | id=' || id || ' | layout=' || COALESCE(\"layoutX\"::text,'NULL') || ',' || COALESCE(\"layoutY\"::text,'NULL') || ',' || COALESCE(\"layoutW\"::text,'NULL') || ',' || COALESCE(\"layoutH\"::text,'NULL') FROM \"Room\" ORDER BY name;"

echo "=== 2. Lab-2 존재 여부 ==="
$P -c "SELECT CASE WHEN EXISTS(SELECT 1 FROM \"Room\" WHERE name ILIKE '%lab%2%' OR name ILIKE '%lab-2%') THEN 'EXISTS' ELSE 'NOT_FOUND' END;"

echo "=== 3. Lab-2 없으면 생성 ==="
$P_CMD -c "INSERT INTO \"Room\" (id, name, \"dataCenterId\", \"layoutX\", \"layoutY\", \"layoutW\", \"layoutH\")
   SELECT 'room-lab2', 'LAB-2',
     (SELECT id FROM \"DataCenter\" LIMIT 1),
     12, 345, 665, 293
   WHERE NOT EXISTS (SELECT 1 FROM \"Room\" WHERE name ILIKE '%lab%2%' OR name ILIKE '%lab-2%');"

echo "=== 4. 결과 확인 ==="
$P -c "SELECT name || ' | id=' || id FROM \"Room\" ORDER BY name;"
