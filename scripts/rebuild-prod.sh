#!/bin/bash
# 프로덕션 빌드 수동 실행 + 서비스 재시작
# 사용법: sudo bash scripts/rebuild-prod.sh
set -eo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

export PATH=$HOME/opt/node-20/bin:$PATH

echo "=== 1. DB 환경변수 설정 ==="
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null || true)
REAL_PASSWORD=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2- || true)
if [ -z "$REAL_PASSWORD" ]; then
  REAL_PASSWORD="${DB_PASSWORD:-dcim_password}"
fi
REAL_PORT=$(docker compose port db 5432 2>/dev/null | cut -d: -f2 || true)
if [ -z "$REAL_PORT" ]; then
  REAL_PORT="${DB_PORT:-5432}"
fi
export DATABASE_URL="postgresql://dcim:${REAL_PASSWORD}@localhost:${REAL_PORT}/dcim?schema=public"
echo "DB URL 설정 완료"
echo ""

echo "=== 2. Prisma 준비 ==="
# stale client 삭제 → 반드시 새로 생성하도록 강제
rm -rf node_modules/.prisma/client
echo "  기존 .prisma/client 삭제"

# generate 먼저 (DB 연결 불필요, 타입 생성만)
npx prisma generate
echo "  prisma generate 완료"

# db push (스키마 → DB 동기화)
# DB 연결 실패 시에도 빌드는 계속 진행 (스키마가 이미 반영되어 있을 수 있음)
if npx prisma db push; then
  echo "  prisma db push 완료"
else
  echo "  [경고] prisma db push 실패 — DB 연결을 확인하세요"
  echo "  빌드는 계속 진행합니다 (서버 기동 후 수동 실행 필요할 수 있음)"
fi
echo ""

echo "=== 3. 프로덕션 빌드 ==="
# stale Next.js 빌드 캐시 삭제
rm -rf .next
echo "  기존 .next 캐시 삭제"

npm run build 2>&1
echo ""
echo "빌드 성공!"
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
