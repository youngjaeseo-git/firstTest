#!/bin/bash
# Docker 상태 확인 + 재빌드 없이 코드 반영 방법 탐색 (38.100)

cd "$(dirname "$0")/../.."

echo "=== 1. 기존 Docker 이미지 ==="
docker images | grep -E "firsttest|dcim" | head -5

echo ""
echo "=== 2. 실행중 컨테이너 ==="
docker compose ps

echo ""
echo "=== 3. 앱 컨테이너 내부 node_modules 존재 ==="
APP_CONTAINER=$(docker compose ps -q app 2>/dev/null)
if [ -n "$APP_CONTAINER" ]; then
  docker exec "$APP_CONTAINER" ls /app/node_modules/.prisma/client 2>/dev/null | head -3 && echo "prisma OK" || echo "prisma MISSING"
  docker exec "$APP_CONTAINER" node -e "console.log('node OK')" 2>/dev/null || echo "node FAIL"
fi

echo ""
echo "=== 4. Docker build cache ==="
docker builder du 2>/dev/null | tail -3 || echo "builder du 불가"

echo ""
echo "=== 5. 앱 실행 방식 확인 ==="
if [ -n "$APP_CONTAINER" ]; then
  docker exec "$APP_CONTAINER" cat /app/package.json 2>/dev/null | grep -E '"name"|"version"' | head -2
  docker exec "$APP_CONTAINER" ls /app/server.js 2>/dev/null && echo "standalone 모드" || echo "standalone 아님"
fi
