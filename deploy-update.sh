#!/bin/bash
# deploy-update.sh — 리눅스 서버에서 최신 코드 반영 후 앱 재시작
# 사용법: ./deploy-update.sh [포트번호]
#   예: ./deploy-update.sh        → 기본 3000번
#       ./deploy-update.sh 3001   → 3001번 포트

set -e

cd "$(dirname "$0")"

export PATH=$HOME/opt/node-20/bin:$PATH

PORT=${1:-3000}
BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
DEPLOY_LOG="$HOME/dcim-logs/deploy-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$HOME/dcim-logs"

# 모든 출력을 로그 파일에도 기록
exec > >(tee -a "$DEPLOY_LOG") 2>&1

echo "=== DCIM 업데이트 스크립트 ==="
echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo "브랜치: $BRANCH"
echo "포트: $PORT"
echo ""

# 1) 기존 dev 서버 종료
echo "[1/7] 기존 서버 프로세스 종료..."
pkill -f "next dev" 2>/dev/null && echo "  → 기존 서버 종료됨" || echo "  → 실행 중인 서버 없음"
sleep 1

# 2) DB 컨테이너 확인
echo "[2/7] DB 컨테이너 확인..."
if ! docker info > /dev/null 2>&1; then
  echo "  ❌ Docker가 실행되지 않고 있습니다."
  exit 1
fi

if ! docker compose ps db 2>/dev/null | grep -q "healthy"; then
  echo "  DB 컨테이너 시작 중..."
  docker compose up -d db
  for i in $(seq 1 30); do
    if docker compose ps db 2>/dev/null | grep -q "healthy"; then
      echo "  ✅ DB 준비 완료"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "  ❌ DB가 30초 안에 준비되지 않았습니다."
      exit 1
    fi
    sleep 1
  done
else
  echo "  ✅ DB 정상 실행 중"
fi

# 3) 배포 전 DB 백업
echo "[3/7] 배포 전 DB 백업..."
if [ -f "scripts/backup-db.sh" ]; then
  bash scripts/backup-db.sh 2>&1 | sed 's/^/  /'
else
  echo "  → backup-db.sh 없음 — 백업 건너뜀"
fi

# 4) 코드 업데이트
echo "[4/7] 코드 업데이트..."
if [ -f "$HOME/nfs-share/firstTest.tar.gz" ]; then
  echo "  NFS에서 소스 업데이트..."
  tar xzf "$HOME/nfs-share/firstTest.tar.gz" -C "$(dirname "$PWD")" --strip-components=0
  echo "  → 소스 복사 완료"
else
  echo "  git pull..."
  git pull origin "$BRANCH" 2>&1 | sed 's/^/  /'
fi

# 5) 의존성 설치
echo "[5/7] npm install..."
npm install --prefer-offline 2>/dev/null || npm install

# 6) Prisma 클라이언트 생성 + 마이그레이션
echo "[6/7] Prisma generate & migrate..."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
REAL_PASSWORD=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
REAL_PASSWORD="${REAL_PASSWORD:-${DB_PASSWORD:-dcim_password}}"
REAL_PORT=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
REAL_PORT="${REAL_PORT:-${DB_PORT:-5432}}"
export DATABASE_URL="postgresql://dcim:${REAL_PASSWORD}@localhost:${REAL_PORT}/dcim?schema=public"

npx prisma generate 2>&1 | tail -1
npx prisma migrate deploy 2>&1 || echo "  → 마이그레이션 변경 없음"

# 7) 서버 시작
echo "[7/7] 개발 서버 시작 (포트 $PORT)..."
echo ""
nohup npm run dev -- -p "$PORT" > /tmp/dcim-app.log 2>&1 &
APP_PID=$!

# 서버 정상 시작 확인 (최대 15초)
echo "서버 시작 확인 중..."
for i in $(seq 1 15); do
  if curl -s --connect-timeout 2 "http://localhost:$PORT" > /dev/null 2>&1; then
    echo ""
    echo "=== 배포 완료 ==="
    echo "  PID: $APP_PID"
    echo "  접속: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "  로그: tail -f /tmp/dcim-app.log"
    echo "  배포 기록: $DEPLOY_LOG"
    exit 0
  fi
  sleep 1
done

echo ""
echo "⚠️  서버가 15초 안에 응답하지 않습니다."
echo "  PID $APP_PID 는 시작되었으니 잠시 후 다시 확인하세요."
echo "  로그: tail -f /tmp/dcim-app.log"
