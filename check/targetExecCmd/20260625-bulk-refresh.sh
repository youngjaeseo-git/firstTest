#!/bin/bash
# 전체 서버 Bulk HW Refresh (웹앱 API 경유, BMC 프록시 사용)
# 실행: bash check/targetExecCmd/20260625-bulk-refresh.sh
# 소요시간: 서버당 5~15초, 30대 기준 3~8분
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

APP_URL="http://localhost:3000"
COOKIE="/tmp/dcim-bulk-cookie.txt"
rm -f "$COOKIE"

# JSON에서 키 값 추출 (python3 없어도 동작)
json_val() {
  local key="$1"
  if command -v python3 &>/dev/null; then
    python3 -c "import sys,json; print(json.load(sys.stdin).get('$key',''))"
  else
    grep -oP "\"$key\"\s*:\s*\"[^\"]*\"" | head -1 | sed "s/.*\"$key\"\s*:\s*\"\([^\"]*\)\".*/\1/"
  fi
}

# 0. Rack→Room 체인 확인 (bmcProxyUrl 누락 장비 검출)
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then echo "ERR: DB 컨테이너 없음"; exit 1; fi
P="docker exec $DB_CONTAINER psql -U dcim -d dcim -t -A"

NO_PROXY=$($P -c "SELECT COUNT(*) FROM \"Equipment\" e WHERE e.type='SERVER' AND e.\"bmcIpAddress\" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM \"Rack\" r JOIN \"Room\" rm ON r.\"roomId\"=rm.id WHERE r.id=e.\"rackId\" AND rm.\"bmcProxyUrl\" IS NOT NULL);")
TOTAL=$($P -c "SELECT COUNT(*) FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NOT NULL;")
echo "CHAIN: TOTAL=$TOTAL NO_PROXY=$NO_PROXY"

if [ "$NO_PROXY" -gt 0 ] 2>/dev/null; then
  echo "WARN: ${NO_PROXY}대 bmcProxyUrl 누락 (Rack→Room 체인 확인 필요)"
  $P -c "SELECT e.hostname || ' rack=' || COALESCE(r.name,'NULL') || ' room=' || COALESCE(rm.name,'NULL') FROM \"Equipment\" e LEFT JOIN \"Rack\" r ON r.id=e.\"rackId\" LEFT JOIN \"Room\" rm ON rm.id=r.\"roomId\" WHERE e.type='SERVER' AND e.\"bmcIpAddress\" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM \"Rack\" r2 JOIN \"Room\" rm2 ON r2.\"roomId\"=rm2.id WHERE r2.id=e.\"rackId\" AND rm2.\"bmcProxyUrl\" IS NOT NULL) LIMIT 5;"
fi

# 1. CSRF 토큰 획득
CSRF=$(curl -s -c "$COOKIE" "$APP_URL/api/auth/csrf" 2>/dev/null | json_val csrfToken)
if [ -z "$CSRF" ]; then
  echo "ERR: CSRF 토큰 획득 실패. 앱이 실행 중인지 확인"
  rm -f "$COOKIE"
  exit 1
fi
echo "CSRF=OK"

# 2. NextAuth 로그인
LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -c "$COOKIE" \
  -X POST "$APP_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin%40dcim.local&password=admin123&csrfToken=$CSRF" \
  -L 2>/dev/null)
echo "LOGIN=$LOGIN"

# 세션 확인
SESSION_USER=$(curl -s -b "$COOKIE" "$APP_URL/api/auth/session" 2>/dev/null | json_val email)
if [ -z "$SESSION_USER" ]; then
  echo "ERR: 로그인 실패. admin@dcim.local / admin123 확인"
  rm -f "$COOKIE"
  exit 1
fi
echo "SESSION=$SESSION_USER"

# 3. 서버 ID 목록 추출
IDS=$($P -c "SELECT string_agg('\"' || id || '\"', ',') FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NOT NULL;")
if [ -z "$IDS" ]; then
  echo "ERR: 서버 없음"
  rm -f "$COOKIE"
  exit 1
fi

COUNT=$(echo "$IDS" | tr -cd ',' | wc -c | tr -d ' ')
COUNT=$((COUNT + 1))
echo "=== ${COUNT}대 서버 Bulk HW Refresh 시작 ==="

# 4. Bulk refresh API 호출 (타임아웃 10분)
RESULT=$(curl -s -b "$COOKIE" --max-time 600 \
  -X POST "$APP_URL/api/equipment/bulk-bmc" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"refresh-hw\",\"equipmentIds\":[$IDS]}")

# 5. 결과 요약
if command -v python3 &>/dev/null; then
  echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  ok=d.get('succeeded',0); fail=d.get('failed',0)
  print('OK=' + str(ok) + ' FAIL=' + str(fail))
  for x in d.get('results',[]):
    if not x.get('success'):
      print('  FAIL:' + (x.get('hostname') or '?')[:20] + ' ' + (x.get('error') or '?')[:50])
except Exception as e:
  print('ERR: ' + str(e))
" 2>/dev/null
else
  OK_CNT=$(echo "$RESULT" | grep -oP '"succeeded":\s*\d+' | grep -oP '\d+')
  FAIL_CNT=$(echo "$RESULT" | grep -oP '"failed":\s*\d+' | grep -oP '\d+')
  echo "OK=${OK_CNT:-?} FAIL=${FAIL_CNT:-?}"
fi

rm -f "$COOKIE"

echo ""
echo "=== 결과 확인 ==="
$P -c "SELECT 'CPU=' || (SELECT COUNT(DISTINCT \"equipmentId\") FROM \"EquipmentCpu\") || ' MEM=' || (SELECT COUNT(*) FROM \"Equipment\" WHERE \"totalMemoryGB\">0 AND type='SERVER') || ' BIOS=' || (SELECT COUNT(*) FROM \"Equipment\" WHERE \"biosVersion\" IS NOT NULL AND type='SERVER');"

echo "=== 완료 ==="
