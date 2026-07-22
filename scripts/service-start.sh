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
  # 재빌드 조건: BUILD_ID 없음 OR .next/static 비어있음(부분/훼손 빌드) OR src가 더 최신.
  # .next/static 검사가 핵심 — 훼손된 .next를 그대로 서빙해 청크 404가 나던 문제 방지.
  if [ ! -f ".next/BUILD_ID" ] \
     || [ -z "$(ls -A .next/static 2>/dev/null)" ] \
     || [ "$(find src -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]; then
    echo "[dcim] 빌드 실행..."
    npm run build || { echo "[dcim] 빌드 실패 — 기동 중단(훼손된 .next 서빙 방지)"; exit 1; }
    echo "[dcim] 빌드 완료"
  else
    echo "[dcim] 빌드 캐시 사용 (변경 없음, .next/static 존재 확인됨)"
  fi
  # 최종 산출물 검증 — 불완전하면 청크 404가 나므로 아예 시작하지 않음
  if [ ! -s ".next/BUILD_ID" ] || [ -z "$(ls -A .next/static 2>/dev/null)" ]; then
    echo "[dcim] [FATAL] 빌드 산출물 불완전(.next/BUILD_ID 또는 .next/static 없음) — 기동 중단"
    exit 1
  fi
  exec npm run start -- -p "$PORT"
else
  echo "[dcim] 개발 모드 (port=$PORT, hot-reload 활성)"
  exec npm run dev -- -p "$PORT"
fi
