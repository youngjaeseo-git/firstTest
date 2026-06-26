#!/bin/bash
# rackHeight 일괄 변경: SPR(SYS-121H*) 제외 전부 2U (38.100에서 실행)

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
# -t -A 제거 버전 (UPDATE 등 비데이터 명령용)
P_CMD=$(echo "$P" | sed 's/ -t -A//')

echo "=== 1. 현재 rackHeight 분포 ==="
$P -c "SELECT '1U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=1) || ' | 2U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=2) || ' | etc=' || COUNT(*) FILTER (WHERE \"rackHeight\" NOT IN (1,2)) FROM \"Equipment\";"

echo "=== 2. model별 장비 수 ==="
$P -c "SELECT COALESCE(model,'NULL') || '=' || COUNT(*) FROM \"Equipment\" GROUP BY model ORDER BY COUNT(*) DESC;"

echo "=== 3. SPR(1U 유지) 대상: model LIKE SYS-121H% ==="
$P -c "SELECT COUNT(*) || '대' FROM \"Equipment\" WHERE model LIKE 'SYS-121H%';"

echo "=== 4. 변경 대상 (1U인데 SPR 아닌 장비 수) ==="
$P -c "SELECT COUNT(*) FROM \"Equipment\" WHERE \"rackHeight\"=1 AND (model IS NULL OR model NOT LIKE 'SYS-121H%');"

echo "=== 5. 변경 실행 ==="
$P_CMD -c "UPDATE \"Equipment\" SET \"rackHeight\"=2 WHERE \"rackHeight\"=1 AND (model IS NULL OR model NOT LIKE 'SYS-121H%');"

echo "=== 6. 변경 후 분포 ==="
$P -c "SELECT '1U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=1) || ' | 2U=' || COUNT(*) FILTER (WHERE \"rackHeight\"=2) || ' | etc=' || COUNT(*) FILTER (WHERE \"rackHeight\" NOT IN (1,2)) FROM \"Equipment\";"
