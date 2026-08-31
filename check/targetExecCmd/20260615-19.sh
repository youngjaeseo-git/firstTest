#!/bin/bash
# 우리 앱(DCIM)만 확인 (38.100, docker-compose.yml 있는 폴더에서 실행)

cd "$(dirname "$0")/../.."

echo "=== 1. compose 서비스 (우리 앱만) ==="
docker compose ps --format "{{.Service}} | {{.Image}} | {{.Status}}" 2>/dev/null

echo ""
echo "=== 2. app 컨테이너 이미지 상세 ==="
APP_IMG=$(docker compose ps app --format "{{.Image}}" 2>/dev/null)
echo "이미지: $APP_IMG"
docker images "$APP_IMG" --format "{{.Repository}}:{{.Tag}} | {{.Size}} | 생성:{{.CreatedSince}}" 2>/dev/null

echo ""
echo "=== 3. app 안에 우리 코드(빌드된 server.js) 있나 ==="
APP_C=$(docker compose ps -q app 2>/dev/null)
docker exec "$APP_C" ls -la /app/server.js 2>/dev/null && echo "standalone OK" || echo "server.js 없음"
docker exec "$APP_C" ls /app/node_modules 2>/dev/null | wc -l | xargs echo "node_modules 항목수:"
