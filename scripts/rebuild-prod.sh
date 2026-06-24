#!/bin/bash
# 프로덕션 빌드 수동 실행 + 서비스 재시작
# 사용법: sudo bash scripts/rebuild-prod.sh
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

export PATH=$HOME/opt/node-20/bin:$PATH

echo "=== 1. DB 환경변수 설정 ==="
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
echo "DB URL 설정 완료"
echo ""

echo "=== 2. Prisma 준비 ==="
npx prisma db push 2>&1 | tail -3
npx prisma generate 2>&1 | tail -1
echo ""

echo "=== 3. 프로덕션 빌드 ==="
npm run build 2>&1
echo ""
echo "✅ 빌드 성공!"
echo ""

echo "=== 4. 서비스 재시작 ==="
if systemctl is-active dcim >/dev/null 2>&1 || systemctl is-enabled dcim >/dev/null 2>&1; then
  systemctl restart dcim
  echo "✅ dcim 서비스 재시작 완료"
  echo ""
  echo "상태 확인: sudo systemctl status dcim"
  echo "로그 확인: sudo journalctl -u dcim -f"
else
  echo "dcim.service 없음 — 수동 실행:"
  echo "  npm run start -- -p 3000"
fi
