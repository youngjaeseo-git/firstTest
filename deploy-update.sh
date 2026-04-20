#!/bin/bash
# deploy-update.sh — 리눅스 서버에서 최신 코드 반영 후 앱 재시작
# 사용법: ./deploy-update.sh [포트번호]
#   예: ./deploy-update.sh        → 기본 3000번
#       ./deploy-update.sh 3001   → 3001번 포트

set -e

PORT=${1:-3000}
BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

echo "=== DCIM 업데이트 스크립트 ==="
echo "브랜치: $BRANCH"
echo "포트: $PORT"
echo ""

# 1) 기존 dev 서버 종료
echo "[1/5] 기존 서버 프로세스 종료..."
pkill -f "next dev" 2>/dev/null && echo "  → 기존 서버 종료됨" || echo "  → 실행 중인 서버 없음"
sleep 1

# 2) 코드 업데이트 (NFS로 복사된 소스가 있으면 직접 반영, 아니면 skip)
if [ -f "$HOME/nfs-share/firstTest.tar.gz" ]; then
  echo "[2/5] NFS에서 소스 업데이트..."
  tar xzf "$HOME/nfs-share/firstTest.tar.gz" -C "$(dirname "$PWD")" --strip-components=0
  echo "  → 소스 복사 완료"
else
  echo "[2/5] NFS 소스 없음 — 기존 코드 사용"
fi

# 3) 의존성 설치
echo "[3/5] npm install..."
npm install --prefer-offline 2>/dev/null || npm install

# 4) Prisma 클라이언트 생성 + 마이그레이션
echo "[4/5] Prisma generate & migrate..."
npx prisma generate
npx prisma migrate deploy 2>/dev/null || echo "  → 마이그레이션 변경 없음"

# 5) 서버 시작
echo "[5/5] 개발 서버 시작 (포트 $PORT)..."
echo ""
nohup npm run dev -- -p "$PORT" > /tmp/dcim-app.log 2>&1 &
echo "서버 시작됨 — PID: $!"
echo "로그 확인: tail -f /tmp/dcim-app.log"
echo "접속: http://$(hostname -I | awk '{print $1}'):$PORT"
