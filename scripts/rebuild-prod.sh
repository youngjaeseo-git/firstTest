#!/bin/bash
# 프로덕션 빌드 수동 실행 + 서비스 재시작
# 사용법: sudo bash scripts/rebuild-prod.sh
set -eo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# node 바이너리 경로 (서버 환경에 맞게 자동 탐색)
if [ -d "$HOME/opt/node-20/bin" ]; then
  export PATH=$HOME/opt/node-20/bin:$PATH
elif [ -d "/opt/node22/bin" ]; then
  export PATH=/opt/node22/bin:$PATH
fi

PRISMA="node $APP_DIR/node_modules/prisma/build/index.js"

echo "=== 0. 모든 Node 프로세스 중지 (NFS lock 방지) ==="
if systemctl is-active dcim >/dev/null 2>&1; then
  systemctl kill --signal=SIGKILL dcim 2>/dev/null || true
  systemctl stop dcim 2>/dev/null || true
  echo "  dcim 서비스 중지"
fi
# 잔여 node 프로세스 정리 (파일 핸들 해제)
pkill -9 -f "node.*firstTest" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 2
echo "  Node 프로세스 정리 완료"
echo ""

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

echo "=== 2. 전체 캐시 삭제 ==="
rm -rf node_modules/.prisma/client
rm -rf .next
rm -f tsconfig.tsbuildinfo
echo "  .prisma/client + .next + tsconfig.tsbuildinfo 삭제"

# NFS stale handle 확인
if ls node_modules/.prisma/client/.nfs* 2>/dev/null; then
  echo "  [경고] NFS stale 파일 감지 — 5초 대기"
  sleep 5
  rm -rf node_modules/.prisma/client 2>/dev/null || true
fi
echo ""

echo "=== 3. Prisma 준비 ==="
# npx 대신 직접 실행 (폐쇄망에서 .bin 심볼릭 링크 소실 대비)
$PRISMA generate
echo "  prisma generate 완료"

# 생성된 타입 검증 — approved 필드가 반드시 있어야 함
if ! grep -q "approved" node_modules/.prisma/client/index.d.ts 2>/dev/null; then
  echo ""
  echo "[FATAL] prisma generate 실패: index.d.ts에 approved 필드 없음"
  echo "  schema 확인:"
  grep "approved" prisma/schema.prisma || echo "  (schema에도 없음!)"
  echo "  빌드를 중단합니다."
  exit 1
fi
echo "  타입 검증 OK (approved 필드 확인)"

# NFS 캐시 flush
sync 2>/dev/null || true

# db push (스키마 → DB 동기화)
if $PRISMA db push; then
  echo "  prisma db push 완료"
else
  echo "  [경고] prisma db push 실패 — DB 연결을 확인하세요"
  echo "  빌드는 계속 진행합니다 (서버 기동 후 수동 실행 필요할 수 있음)"
fi
echo ""

echo "=== 4. 프로덕션 빌드 ==="
npm run build 2>&1
echo ""
echo "빌드 성공!"
echo ""

echo "=== 5. 서비스 시작 ==="
if systemctl is-enabled dcim >/dev/null 2>&1; then
  systemctl start dcim
  echo "✅ dcim 서비스 시작 완료"
  echo ""
  echo "상태 확인: sudo systemctl status dcim"
  echo "로그 확인: sudo journalctl -u dcim -f"
else
  echo "dcim.service 없음 — 수동 실행:"
  echo "  npm run start -- -p 3000"
fi
