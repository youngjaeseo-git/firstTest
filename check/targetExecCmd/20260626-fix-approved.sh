#!/bin/bash
# admin 유저 approved=true 설정 + UserOrganization 테이블 존재 확인
cd "$(dirname "$0")/../.."

# DB 접근 자동 탐지
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

echo "=== 1. approved 현황 ==="
$P -c "SELECT email || '=' || approved::text FROM \"User\" ORDER BY email;"

echo "=== 2. approved=true 설정 ==="
$P_CMD -c "UPDATE \"User\" SET approved=true WHERE approved=false;"

echo "=== 3. UserOrganization 테이블 존재 확인 ==="
$P -c "SELECT CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='UserOrganization') THEN 'EXISTS' ELSE 'MISSING' END;"

echo "=== 4. 결과 ==="
$P -c "SELECT email || '=' || approved::text FROM \"User\" ORDER BY email;"
