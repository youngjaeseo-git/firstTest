#!/bin/bash
# 서버 데이터 일괄 복구: 1) kernel biosVersion 정리  2) Bulk HW Refresh
# 실행: bash check/targetExecCmd/20260625-fix-server-data.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then echo "ERR: DB 컨테이너 없음"; exit 1; fi
P="docker exec $DB_CONTAINER psql -U dcim -d dcim -t -A"

echo "=== F1. kernel biosVersion 정리 ==="
$P -c "UPDATE \"Equipment\" SET \"biosVersion\"=NULL WHERE \"biosVersion\" LIKE 'kernel %';"
echo "kernel biosVersion → NULL 완료"

echo "=== F2. Bulk HW Refresh (전체 서버) ==="
# 서버 ID 목록 추출
IDS=$($P -c "SELECT string_agg('\"' || id || '\"', ',') FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NOT NULL;")

if [ -z "$IDS" ]; then
  echo "ERR: 서버 없음"
  exit 1
fi

# 로그인 → 쿠키 획득
COOKIE_FILE="/tmp/dcim-cookie.txt"
LOGIN_RES=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_FILE" \
  -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123&csrfToken=&callbackUrl=http%3A%2F%2Flocalhost%3A3000&json=true")

if [ "$LOGIN_RES" != "200" ] && [ "$LOGIN_RES" != "302" ]; then
  echo "ERR: 로그인 실패 (HTTP $LOGIN_RES). admin/admin123 확인 필요"
  echo "수동으로 웹에서 Settings > BMC 화면에서 Bulk Refresh 가능"
  rm -f "$COOKIE_FILE"
  exit 1
fi

# Bulk refresh-hw API 호출
echo "서버 $( echo "$IDS" | tr -cd ',' | wc -c | tr -d ' ')대 + 1 HW Refresh 시작..."
RESULT=$(curl -s -b "$COOKIE_FILE" \
  -X POST http://localhost:3000/api/equipment/bulk-bmc \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"refresh-hw\",\"equipmentIds\":[$IDS]}")

# 결과 요약만 출력
echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  r=d.get('results',[])
  ok=sum(1 for x in r if x.get('success'))
  fail=sum(1 for x in r if not x.get('success'))
  print(f'OK={ok} FAIL={fail}')
  for x in r:
    if not x.get('success'):
      print(f\"  FAIL: {x.get('hostname','?')} - {x.get('error','?')[:40]}\")
except: print('결과 파싱 실패. 원본:', d if 'd' in dir() else 'empty')
" 2>/dev/null || echo "결과: $RESULT" | head -c 200

rm -f "$COOKIE_FILE"

echo ""
echo "=== F3. 결과 확인 ==="
$P -c "SELECT 'CPU=' || (SELECT COUNT(DISTINCT \"equipmentId\") FROM \"EquipmentCpu\") || ' MEM=' || (SELECT COUNT(*) FROM \"Equipment\" WHERE \"totalMemoryGB\">0 AND type='SERVER') || ' BIOS=' || (SELECT COUNT(*) FROM \"Equipment\" WHERE \"biosVersion\" IS NOT NULL AND type='SERVER');"

echo "=== 완료 ==="
