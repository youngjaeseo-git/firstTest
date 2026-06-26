#!/bin/bash
# DCIM 환경 진단 — 배포 방식, 앱 접근, DB 접근을 한 번에 확인
# 실행: bash check/targetExecCmd/20260626.sh
# 출력: 5~8줄 (타이핑 최소화)
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

echo "=== 1. APP ==="
for URL in "http://localhost:3000" "http://10.144.38.100:3000"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL" 2>/dev/null)
  echo "  $URL = $CODE"
done

echo "=== 2. DB ==="
# docker-compose
DC=$(docker compose ps -q db 2>/dev/null)
if [ -n "$DC" ]; then
  echo "  docker-compose db=$DC"
  VER=$(docker exec $DC psql -U dcim -d dcim -t -A -c "SELECT version();" 2>/dev/null | head -c 30)
  echo "  psql=$VER"
fi
# K8s pod
KP=$(kubectl get pods -A -o name 2>/dev/null | grep -i -E 'postgres|dcim.*db' | head -1)
if [ -n "$KP" ]; then
  NS=$(kubectl get pods -A 2>/dev/null | grep -i -E 'postgres|dcim.*db' | head -1 | awk '{print $1}')
  POD=$(echo "$KP" | sed 's|pod/||')
  echo "  k8s ns=$NS pod=$POD"
fi
# 로컬 psql
if command -v psql &>/dev/null; then
  LP=$(psql -U dcim -d dcim -t -A -c "SELECT 1;" 2>/dev/null)
  [ "$LP" = "1" ] && echo "  local-psql=OK"
fi
# .env DATABASE_URL
if [ -f .env ]; then
  DBURL=$(grep DATABASE_URL .env | head -1 | sed 's/.*=\s*//' | sed 's/\(.*@[^/]*\).*/\1\/.../')
  echo "  DATABASE_URL=$DBURL"
fi

echo "=== 3. CONTAINER ==="
# DCIM 앱 컨테이너
AC=$(docker compose ps -q app 2>/dev/null || docker compose ps -q web 2>/dev/null || docker compose ps -q nextjs 2>/dev/null)
[ -n "$AC" ] && echo "  docker-app=$AC"
AP=$(kubectl get pods -A -o name 2>/dev/null | grep -i -E 'dcim|firsttest|nextjs' | grep -v db | head -1)
[ -n "$AP" ] && echo "  k8s-app=$AP"

echo "=== 4. SERVER ==="
# 서버 데이터 채움 현황
if [ -n "$DC" ]; then
  P="docker exec $DC psql -U dcim -d dcim -t -A"
elif command -v psql &>/dev/null; then
  P="psql -U dcim -d dcim -t -A"
else
  echo "  DB접근불가"
  exit 0
fi
$P -c "SELECT 'TOT=' || COUNT(*) || ' CPU=' || (SELECT COUNT(DISTINCT \"equipmentId\") FROM \"EquipmentCpu\") || ' MEM=' || COUNT(CASE WHEN \"totalMemoryGB\">0 THEN 1 END) || ' BIOS=' || COUNT(CASE WHEN \"biosVersion\" IS NOT NULL THEN 1 END) FROM \"Equipment\" WHERE type='SERVER';" 2>/dev/null

echo "=== END ==="
