#!/bin/bash
set -e

cd "$(dirname "$0")"

MODE="${1:-}"
PORT="${2:-3000}"

# dummy 모드면 포트가 첫 번째 인자일 수 있음
if [[ "$MODE" =~ ^[0-9]+$ ]]; then
  PORT="$MODE"
  MODE=""
fi

export PATH=$HOME/opt/node-20/bin:$PATH

if [ "$MODE" = "dummy" ] || [ "$MODE" = "demo" ]; then
  echo "================================================"
  echo "  DEMO MODE - 더미 데이터로 실행"
  echo "================================================"
  echo ""
  export DEMO_MODE=true
fi

echo "=== 1. Docker 확인 ==="
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker가 실행되지 않고 있습니다."
  exit 1
fi
echo "✅ Docker 정상"

echo ""
echo "=== 2. DB 컨테이너 확인 ==="
if ! docker compose ps db 2>/dev/null | grep -q "healthy"; then
  echo "DB 컨테이너 시작 중..."
  docker compose up -d db
  echo "DB 준비 대기 중 (최대 30초)..."
  for i in $(seq 1 30); do
    if docker compose ps db 2>/dev/null | grep -q "healthy"; then
      echo "✅ DB 준비 완료"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "❌ DB가 30초 안에 준비되지 않았습니다."
      docker compose logs db --tail=20
      exit 1
    fi
    sleep 1
  done
else
  echo "✅ DB 정상 실행 중"
fi

echo ""
echo "=== 3. DB 마이그레이션 ==="
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
REAL_PASSWORD=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
if [ -z "$REAL_PASSWORD" ]; then
  REAL_PASSWORD="${DB_PASSWORD:-dcim_password}"
fi
REAL_PORT=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
if [ -z "$REAL_PORT" ]; then
  REAL_PORT="${DB_PORT:-5432}"
fi
export DATABASE_URL="postgresql://dcim:${REAL_PASSWORD}@localhost:${REAL_PORT}/dcim?schema=public"

# NextAuth: 고정 시크릿 (미설정 시 매 재시작마다 JWT 무효화 → 로그인 후 빈 화면)
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dcim-nextauth-secret-$(hostname)}"
# NextAuth: 서버 IP 기반 URL (쿠키 도메인 정합성)
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://${SERVER_IP:-localhost}:${PORT}}"

npx prisma migrate deploy 2>&1
if [ $? -eq 0 ]; then
  echo "✅ 마이그레이션 완료"
else
  echo "⚠️  마이그레이션 실패 (신규 마이그레이션이 없을 수 있음)"
fi
npx prisma generate 2>&1 | tail -1

echo ""
echo "=== 4. 서버 시작 ==="
if [ "$DEMO_MODE" = "true" ]; then
  echo "    📌 DEMO MODE (Prometheus 없이 더미 데이터)"
fi
echo "    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${PORT}"
echo "    종료: Ctrl+C"
echo ""

if [ "$MODE" = "prod" ]; then
  echo "    🚀 프로덕션 모드"
  if [ ! -d ".next" ] || [ "$(find src -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]; then
    echo "    빌드 실행 중... (최초 또는 코드 변경 시)"
    npm run build
    echo "    ✅ 빌드 완료"
  else
    echo "    ✅ 빌드 캐시 사용 (변경 없음)"
  fi
  echo ""
  exec npm run start -- -p "$PORT"
else
  echo "    🔧 개발 모드 (hot-reload 활성)"
  echo ""
  exec npm run dev -- -p "$PORT"
fi
