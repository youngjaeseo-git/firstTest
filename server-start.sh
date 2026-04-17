#!/bin/bash
set -e

cd "$(dirname "$0")"

PORT=${1:-3000}

export PATH=$HOME/opt/node-20/bin:$PATH

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
echo "=== 3. 개발 서버 시작 ==="
echo "    http://$(hostname -I | awk '{print $1}'):${PORT}"
echo "    종료: Ctrl+C"
echo ""
npm run dev -- -p "$PORT"
