#!/bin/bash
# 인증 문제 진단 (38.100에서 실행)
# ★★★ run.sh로 앱이 실행 중인 상태에서, 별도 터미널에서 실행 ★★★

echo "=== 1. NEXTAUTH 환경변수 확인 ==="
# run.sh가 설정한 환경변수가 실제로 적용됐는지
ps aux | grep "next dev" | grep -v grep | head -1 | awk '{print "PID:", $2}'
echo "NEXTAUTH_SECRET 설정 여부: $(env | grep -c NEXTAUTH_SECRET)"
echo "NEXTAUTH_URL 설정 여부: $(env | grep -c NEXTAUTH_URL)"

echo ""
echo "=== 2. hostname -I 결과 (NEXTAUTH_URL에 사용됨) ==="
echo "hostname -I 첫번째IP: $(hostname -I 2>/dev/null | awk '{print $1}')"
echo "hostname: $(hostname)"

echo ""
echo "=== 3. DB에 사용자 존재 여부 ==="
# docker compose로 DB 조회
cd /root/dany/firstTest 2>/dev/null || cd ~/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." 2>/dev/null
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -n "$DB_CONTAINER" ]; then
  USERS=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c "SELECT count(*) FROM \"User\";" 2>/dev/null | tr -d ' ')
  echo "등록된 사용자 수: $USERS"
  if [ "$USERS" = "0" ] || [ -z "$USERS" ]; then
    echo "WARNING: 사용자 0명 → 로그인 불가! npx tsx prisma/seed.ts 실행 필요"
  else
    docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -c "SELECT email, role FROM \"User\";" 2>/dev/null | head -3
  fi
else
  echo "DB 컨테이너 없음"
fi

echo ""
echo "=== 4. NextAuth API 응답 확인 ==="
# /api/auth/providers 가 정상 응답하는지
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://localhost:3000/api/auth/providers")
echo "/api/auth/providers HTTP: $CODE"

# /api/auth/csrf 토큰
CSRF=$(curl -s --connect-timeout 3 "http://localhost:3000/api/auth/csrf" 2>/dev/null)
echo "/api/auth/csrf: $(echo "$CSRF" | grep -o '"csrfToken"' | wc -l)개 토큰"

echo ""
echo "=== 5. 로그인 테스트 (admin@dcim.local) ==="
# CSRF 토큰 + 쿠키로 실제 로그인 시도
COOKIE_JAR="/tmp/auth-test-cookies.txt"
rm -f "$COOKIE_JAR"
CSRF_TOKEN=$(curl -s -c "$COOKIE_JAR" "http://localhost:3000/api/auth/csrf" 2>/dev/null | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
LOGIN_RESULT=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST \
  "http://localhost:3000/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=${CSRF_TOKEN}&email=admin@dcim.local&password=admin123&callbackUrl=/" \
  -w "\nHTTP:%{http_code}" 2>/dev/null)
HTTP_CODE=$(echo "$LOGIN_RESULT" | grep "^HTTP:" | cut -d: -f2)
echo "로그인 응답 HTTP: $HTTP_CODE"
if echo "$LOGIN_RESULT" | grep -q "session-token"; then
  echo "세션 쿠키: 설정됨"
elif grep -q "session-token" "$COOKIE_JAR" 2>/dev/null; then
  echo "세션 쿠키: 설정됨 (쿠키 파일)"
else
  echo "세션 쿠키: 없음 → 로그인 실패"
  echo "응답 내용 (마지막 200자):"
  echo "$LOGIN_RESULT" | tail -c 200
fi
rm -f "$COOKIE_JAR"

echo ""
echo "=== 완료 ==="
