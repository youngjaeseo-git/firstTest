#!/bin/bash
# 전체 서버 Bulk HW Refresh (웹앱 API 경유, BMC 프록시 사용)
# 실행: bash check/targetExecCmd/20260625-bulk-refresh.sh
# 소요시간: 서버당 5~15초, 30대 기준 3~8분
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

APP_URL="http://localhost:3000"
COOKIE="/tmp/dcim-bulk-cookie.txt"
rm -f "$COOKIE"

# 1. CSRF 토큰 획득
CSRF=$(curl -s -c "$COOKIE" "$APP_URL/api/auth/csrf" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null)
if [ -z "$CSRF" ]; then
  echo "ERR: CSRF 토큰 획득 실패. 앱이 실행 중인지 확인"
  rm -f "$COOKIE"
  exit 1
fi
echo "CSRF=OK"

# 2. NextAuth 로그인 (email 방식)
LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -c "$COOKIE" \
  -X POST "$APP_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin%40dcim.local&password=admin123&csrfToken=$CSRF" \
  -L 2>/dev/null)
echo "LOGIN=$LOGIN"

# 세션 확인
SESSION=$(curl -s -b "$COOKIE" "$APP_URL/api/auth/session" 2>/dev/null)
HAS_USER=$(echo "$SESSION" | python3 -c "import sys,json; d=json.load(sys.stdin); print('YES' if d.get('user') else 'NO')" 2>/dev/null)
echo "SESSION=$HAS_USER"

if [ "$HAS_USER" != "YES" ]; then
  echo "ERR: 로그인 실패. admin@dcim.local / admin123 확인"
  rm -f "$COOKIE"
  exit 1
fi

# 3. DB 컨테이너에서 서버 ID 목록 추출
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then
  echo "ERR: DB 컨테이너 없음"
  rm -f "$COOKIE"
  exit 1
fi
P="docker exec $DB_CONTAINER psql -U dcim -d dcim -t -A"

IDS=$($P -c "SELECT string_agg('\"' || id || '\"', ',') FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NOT NULL;")
if [ -z "$IDS" ]; then
  echo "ERR: 서버 없음"
  rm -f "$COOKIE"
  exit 1
fi

COUNT=$(echo "$IDS" | tr -cd ',' | wc -c | tr -d ' ')
COUNT=$((COUNT + 1))
echo "=== $COUNT 대 서버 Bulk HW Refresh 시작 ==="

# 4. Bulk refresh API 호출 (타임아웃 10분)
RESULT=$(curl -s -b "$COOKIE" --max-time 600 \
  -X POST "$APP_URL/api/equipment/bulk-bmc" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"refresh-hw\",\"equipmentIds\":[$IDS]}")

# 5. 결과 요약
echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  ok=d.get('succeeded',0)
  fail=d.get('failed',0)
  print('OK=' + str(ok) + ' FAIL=' + str(fail))
  for x in d.get('results',[]):
    if not x.get('success'):
      print('  FAIL:' + (x.get('hostname') or '?')[:20] + ' ' + (x.get('error') or '?')[:50])
except Exception as e:
  print('파싱실패: ' + str(e))
" 2>/dev/null || echo "결과: ${RESULT:0:200}"

rm -f "$COOKIE"

echo ""
echo "=== 결과 확인 ==="
$P -c "SELECT 'CPU=' || (SELECT COUNT(DISTINCT \"equipmentId\") FROM \"EquipmentCpu\") || ' MEM=' || (SELECT COUNT(*) FROM \"Equipment\" WHERE \"totalMemoryGB\">0 AND type='SERVER') || ' BIOS=' || (SELECT COUNT(*) FROM \"Equipment\" WHERE \"biosVersion\" IS NOT NULL AND type='SERVER');"

echo "=== 완료 ==="
