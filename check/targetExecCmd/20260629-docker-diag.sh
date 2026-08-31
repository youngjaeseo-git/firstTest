#!/bin/bash
# 도커 스택 상태 진단 (읽기 전용 — 아무것도 변경/재생성하지 않음)
# 목적: dcim-* 운영 스택 vs firsttest-* 가 섞였는지, 실제 이미지/볼륨 확인
# 실행: 서버에서 bash check/targetExecCmd/20260629-docker-diag.sh
echo "=== DOCKER_DIAG (read-only) ==="
echo "PWD=$(basename "$(pwd)")  COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-(unset)}"

echo "-- 컨테이너 (이름 | 이미지 | 상태) --"
docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null | grep -iE 'dcim|firsttest|postgres'

echo "-- dcim-app 이 붙은 이미지/DB --"
echo "  IMG=$(docker inspect dcim-app --format '{{.Config.Image}}' 2>/dev/null)"
echo "  DB_URL=$(docker inspect dcim-app --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^DATABASE_URL=' | sed 's#:[^:@]*@#:***@#')"
echo "  CRON=$(docker exec dcim-app printenv CRON_SECRET 2>/dev/null | cut -c1-6)..."

echo "-- dcim-db / firsttest-db 볼륨 --"
echo "  dcim-db:  img=$(docker inspect dcim-db --format '{{.Config.Image}}' 2>/dev/null) vol=$(docker inspect dcim-db --format '{{range .Mounts}}{{.Name}} {{end}}' 2>/dev/null) state=$(docker inspect dcim-db --format '{{.State.Status}}' 2>/dev/null)"
echo "  firsttest-db-1: vol=$(docker inspect firsttest-db-1 --format '{{range .Mounts}}{{.Name}} {{end}}' 2>/dev/null) state=$(docker inspect firsttest-db-1 --format '{{.State.Status}}' 2>/dev/null)"

echo "-- 관련 이미지 --"
docker images --format '{{.Repository}}:{{.Tag}}  ({{.Size}})' 2>/dev/null | grep -iE 'dcim|firsttest|app|postgres' | head

echo "-- 관련 볼륨 --"
docker volume ls --format '{{.Name}}' 2>/dev/null | grep -iE 'dcim|firsttest|pgdata|workplace'

echo "-- 서버 docker-compose.yml 핵심 --"
grep -nE 'container_name:|image:|build:|CRON_SECRET|pgdata' docker-compose.yml 2>/dev/null

echo "-- 5432 포트 점유 --"
docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '5432'
echo "=== END ==="
# 해석 포인트:
#  - dcim-db state=running 이고 vol에 pgdata 있으면 운영 DB 안전.
#  - firsttest-db-1 이 같은 pgdata 볼륨을 잡았는지 확인(충돌/공유 여부).
#  - dcim-app IMG= 가 실제 운영 이미지명 → compose image: 핀에 그 값을 써야 재빌드 없이 재생성 가능.
