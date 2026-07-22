#!/bin/bash
# 프로덕션 빌드 수동 실행 + 서비스 재시작
# 사용법: sudo bash scripts/rebuild-prod.sh
set -eo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# node 바이너리 경로 탐색 (sudo로 PATH/$HOME이 root로 바뀌어도 찾도록)
#  수동 지정: NODE_BIN_DIR=/경로/bin sudo -E bash scripts/rebuild-prod.sh
[ -n "${NODE_BIN_DIR:-}" ] && export PATH="$NODE_BIN_DIR:$PATH"

if ! command -v node >/dev/null 2>&1; then
  # 1) 스크립트를 호출한 '실제 사용자'의 로그인 셸에서 node 위치를 물어봄 (nvm/커스텀 설치 대응)
  if [ -n "${SUDO_USER:-}" ]; then
    USER_NODE=$(sudo -u "$SUDO_USER" -i bash -lc 'command -v node' 2>/dev/null || true)
    [ -n "$USER_NODE" ] && [ -x "$USER_NODE" ] && export PATH="$(dirname "$USER_NODE"):$PATH"
  fi
fi
if ! command -v node >/dev/null 2>&1; then
  # 2) 흔한 설치 위치 탐색 (사용자 홈 nvm 포함)
  USER_HOME=$(getent passwd "${SUDO_USER:-$USER}" 2>/dev/null | cut -d: -f6)
  for d in "$HOME/opt/node-20/bin" "$USER_HOME/opt/node-20/bin" \
           /opt/node22/bin /opt/node-20/bin /usr/local/bin /usr/bin \
           "$USER_HOME/.nvm/versions/node"/*/bin; do
    [ -x "$d/node" ] && { export PATH="$d:$PATH"; break; }
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[FATAL] node 실행 파일을 찾지 못했습니다."
  echo "  평소 셸에서 'which node' 결과를 확인한 뒤, 그 경로의 상위 폴더로 아래처럼 실행하세요:"
  echo "    which node          # 예: /home/사용자/.nvm/versions/node/v20.x/bin/node"
  echo "    NODE_BIN_DIR=위경로의 bin폴더 sudo -E bash scripts/rebuild-prod.sh"
  exit 1
fi
echo "  node: $(command -v node) ($(node -v 2>/dev/null))"

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
# NFS에서는 열린 파일 핸들이 .nfs* 로 남아 'Directory not empty'가 나며 rm이 실패한다.
# 견고 삭제: 재시도 → 그래도 남으면 옆으로 비켜두고 빌드 진행(스크립트 중단 방지).
safe_rmrf() {
  local target="$1"
  [ -e "$target" ] || return 0
  rm -rf "$target" 2>/dev/null && return 0
  find "$target" -name '.nfs*' -delete 2>/dev/null || true
  sync 2>/dev/null || true
  sleep 2
  rm -rf "$target" 2>/dev/null && return 0
  # 여전히 남으면(열린 핸들 지속) 이름만 바꿔 비켜두고 계속 — 새 빌드에 지장 없음
  local aside="${target}.stale-$$"
  if mv "$target" "$aside" 2>/dev/null; then
    echo "  [경고] '$target' 삭제 실패(NFS 핸들) → '$aside'로 비켜두고 진행"
  else
    echo "  [경고] '$target' 삭제/이동 모두 실패 — 계속 진행하나 빌드 오류 시 남은 node 프로세스를 확인하세요"
  fi
}
safe_rmrf node_modules/.prisma/client
safe_rmrf .next
rm -f tsconfig.tsbuildinfo 2>/dev/null || true
echo "  .prisma/client + .next + tsconfig.tsbuildinfo 정리 완료"
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

echo "=== 4.5 빌드 산출물 검증 ==="
# set -e가 못 잡는 '빌드는 끝났지만 산출물 불완전' 케이스 차단.
# .next/static 청크가 없으면 서비스 시작 시 'Loading chunk failed'가 난다.
if [ ! -s .next/BUILD_ID ] || [ -z "$(ls -A .next/static 2>/dev/null)" ]; then
  echo "[FATAL] 빌드 산출물 불완전(.next/BUILD_ID 또는 .next/static 없음) — 서비스 시작 중단"
  echo "  .next 를 삭제하고 다시 실행하세요. 서비스는 중지 상태로 둡니다."
  exit 1
fi
echo "  산출물 검증 OK (.next/BUILD_ID + .next/static 존재)"
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
