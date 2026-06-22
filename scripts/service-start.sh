#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

export PATH=$HOME/opt/node-20/bin:$PATH

MODE="${DCIM_MODE:-dev}"
PORT="${DCIM_PORT:-3000}"

echo "[dcim] DB 컨테이너 확인..."
if ! docker compose ps db 2>/dev/null | grep -q "healthy"; then
  docker compose up -d db
  for i in $(seq 1 30); do
    if docker compose ps db 2>/dev/null | grep -q "healthy"; then
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "[dcim] DB 준비 실패 (30초 타임아웃)"
      exit 1
    fi
    sleep 1
  done
fi
echo "[dcim] DB 정상"

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
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dcim-nextauth-secret-$(hostname)}"

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://${SERVER_IP:-localhost}:${PORT}}"

echo "[dcim] Prisma 마이그레이션..."
npx prisma migrate deploy 2>&1 || echo "[dcim] 마이그레이션 스킵 (변경 없음)"
npx prisma generate 2>&1 | tail -1

if [ "$MODE" = "prod" ]; then
  echo "[dcim] 프로덕션 모드 (port=$PORT)"
  if [ ! -f ".next/BUILD_ID" ] || [ "$(find src -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]; then
    echo "[dcim] 빌드 실행..."
    npm run build
    echo "[dcim] 빌드 완료"
  else
    echo "[dcim] 빌드 캐시 사용 (변경 없음)"
  fi
  exec npm run start -- -p "$PORT"
else
  echo "[dcim] 개발 모드 (port=$PORT, hot-reload 활성)"
  exec npm run dev -- -p "$PORT"
fi
