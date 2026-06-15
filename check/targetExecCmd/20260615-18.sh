#!/bin/bash
# Docker 실행 상태 전수 조사 (38.100)

echo "=== 1. 모든 실행중 컨테이너 ==="
docker ps --format "{{.Names}} | {{.Image}} | {{.Status}}" 2>/dev/null

echo ""
echo "=== 2. 모든 Docker 이미지 ==="
docker images --format "{{.Repository}}:{{.Tag}} | {{.Size}} | {{.CreatedSince}}" 2>/dev/null | head -10

echo ""
echo "=== 3. docker compose 프로젝트 위치 ==="
docker compose ls 2>/dev/null || docker-compose ls 2>/dev/null || echo "compose ls 불가"
