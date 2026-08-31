#!/bin/bash
# 배포 방식/현재 가동 상태 진단 (읽기 전용 — 아무것도 변경 안 함)
# 목적: 운영 앱이 docker인지 systemd/npm인지, 현재 살아있는지, firsttest→dcim
#       rename이 어디까지 적용됐는지 확인
# 실행: 어디서든 bash check/targetExecCmd/20260629-deploy-diag.sh (스스로 루트로 이동)
cd "$(dirname "$0")/../.." 2>/dev/null || true
echo "=== DEPLOY_DIAG (read-only) ==="
echo "ROOT=$(pwd)"

echo "-- [A] 앱 살아있나 (포트3000) --"
echo "  HTTP_3000=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 http://localhost:3000 2>/dev/null)"
echo "  LISTEN=$( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':3000|:5432' | sed 's/  */ /g')"

echo "-- [B] systemd 서비스(앱) --"
systemctl list-units --type=service --all 2>/dev/null | grep -iE 'dcim|firsttest|next|dc-express|node' | sed 's/  */ /g' | head
echo "  unit-files=$(systemctl list-unit-files 2>/dev/null | grep -iE 'dcim|firsttest|next|dc-express' | awk '{print $1}' | paste -sd, -)"

echo "-- [C] node/next 프로세스 --"
ps -eo pid,cmd 2>/dev/null | grep -E 'node |next-server|server\.js|npm' | grep -v grep | head -4 | cut -c1-110

echo "-- [D] docker 컨테이너/이미지/볼륨 --"
docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null | grep -iE 'dcim|firsttest|postgres'
echo "  images=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -iE 'dcim|firsttest|app|postgres' | paste -sd', ' -)"
echo "  volumes=$(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -iE 'dcim|firsttest|pgdata' | paste -sd', ' -)"
echo "  dcim-db: state=$(docker inspect dcim-db --format '{{.State.Status}}' 2>/dev/null) vol=$(docker inspect dcim-db --format '{{range .Mounts}}{{.Name}}{{end}}' 2>/dev/null)"

echo "-- [E] postgres 어디서 도나 (포트5432 점유 프로세스) --"
echo "  PG=$( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep ':5432' | sed 's/  */ /g' | head -1)"
echo "  PG_PROC=$(ps -eo cmd 2>/dev/null | grep -E 'postgres|postmaster' | grep -v grep | head -1 | cut -c1-80)"

echo "-- [F] 서버 docker-compose.yml 핵심 --"
grep -nE 'container_name:|image:|build:|name:|external:|pgdata|CRON_SECRET' docker-compose.yml 2>/dev/null
echo "  COMPOSE_PROJECT_NAME(env)=${COMPOSE_PROJECT_NAME:-(unset)}"

echo "-- [G] .env 키 목록(값 마스킹) + DATABASE_URL 호스트 --"
[ -f .env ] && grep -oE '^[A-Z_]+=' .env 2>/dev/null | tr -d '=' | paste -sd, -
echo "  DB_HOST=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | sed 's#.*@\([^/:]*\).*#\1#')"

echo "-- [H] 서버 git 위치 --"
echo "  HEAD=$(git log -1 --format='%h %s' 2>/dev/null | cut -c1-60)"
echo "=== END ==="
