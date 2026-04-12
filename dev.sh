#!/bin/bash
set -e

echo "=== 1. 최신 코드 받기 ==="
git pull origin claude/dcim-management-system-6oyFy

echo ""
echo "=== 2. 패키지 설치 확인 ==="
npm install --silent

echo ""
echo "=== 3. Docker DB 확인 ==="
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker가 실행되지 않고 있습니다. Docker Desktop을 먼저 시작해주세요."
  exit 1
fi

if ! docker compose ps db | grep -q "healthy"; then
  echo "DB 컨테이너 시작 중..."
  docker compose up -d db
  echo "DB 준비 대기 중..."
  sleep 5
else
  echo "✅ DB 정상 실행 중"
fi

echo ""
echo "=== 4. 개발 서버 시작 (http://localhost:3001) ==="
npm run dev -- -p 3001
