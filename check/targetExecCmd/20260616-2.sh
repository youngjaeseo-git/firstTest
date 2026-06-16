#!/bin/bash
# BMC 프록시 코드 반영 (38.100에서 실행)
# npm install 생략 (새 패키지 없음) — 최소 리스크

set -e
cd "$(dirname "$0")/../.."
export PATH=$HOME/opt/node-20/bin:$PATH

echo "=== 1. 현재 브랜치 확인 ==="
BRANCH=$(git branch --show-current 2>/dev/null)
echo "브랜치: $BRANCH"

echo ""
echo "=== 2. 코드 업데이트 ==="
git pull origin claude/dcim-management-system-6oyFy
echo "OK"

echo ""
echo "=== 3. DB 연결 설정 ==="
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
REAL_PASSWORD=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
REAL_PASSWORD="${REAL_PASSWORD:-${DB_PASSWORD:-dcim_password}}"
REAL_PORT=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
REAL_PORT="${REAL_PORT:-${DB_PORT:-5432}}"
export DATABASE_URL="postgresql://dcim:${REAL_PASSWORD}@localhost:${REAL_PORT}/dcim?schema=public"

echo ""
echo "=== 4. Prisma Client 재생성 ==="
npx prisma generate 2>&1 | tail -1

echo ""
echo "=== 5. DB 마이그레이션 ==="
npx prisma migrate deploy 2>&1 || echo "변경 없음"

echo ""
echo "=== 6. 서버 재시작 ==="
pkill -f "next dev" 2>/dev/null && echo "기존 서버 종료" || echo "실행중 서버 없음"
sleep 2

export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dcim-nextauth-secret-$(hostname)}"
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://${SERVER_IP:-localhost}:3000}"

nohup npm run dev -- -p 3000 > /tmp/dcim-app.log 2>&1 &
APP_PID=$!
echo "PID: $APP_PID"

echo ""
echo "=== 7. 시작 확인 (15초) ==="
for i in $(seq 1 15); do
  if curl -s --connect-timeout 2 "http://localhost:3000" > /dev/null 2>&1; then
    echo "앱 정상 기동"
    echo "접속: http://${SERVER_IP}:3000"
    echo "로그: tail -f /tmp/dcim-app.log"
    exit 0
  fi
  sleep 1
done
echo "아직 시작 안됨. 로그 확인: tail -f /tmp/dcim-app.log"
