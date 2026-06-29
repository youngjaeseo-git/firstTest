#!/bin/bash
# dcim-app에 CRON_SECRET 주입 — compose 미사용, dcim-app만 재생성.
# DB(dcim-db)·볼륨·firsttest-* 는 전혀 건드리지 않음. 기존 이미지 재사용(재빌드 없음).
# ⚠️ 먼저 20260629-docker-diag.sh 결과를 공유해 확인받은 뒤 실행하세요.
# 실행: 프로젝트 디렉토리에서 bash check/targetExecCmd/20260629-cron-fix.sh
set -u
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || true
echo "=== CRON_FIX (dcim-app only) ==="

# 0) 가드
docker inspect dcim-app >/dev/null 2>&1 || { echo "ERR: dcim-app 없음. 중단."; exit 1; }
SECRET=$(grep -E '^CRON_SECRET=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
[ -z "$SECRET" ] && { echo "ERR: .env에 CRON_SECRET 없음. 중단."; exit 1; }
echo "CRON_SECRET=${SECRET:0:6}... (len=${#SECRET})"

# 1) 현재 dcim-app 설정 자동 캡처
IMG=$(docker inspect dcim-app --format '{{.Config.Image}}')
NET=$(docker inspect dcim-app --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
RESTART=$(docker inspect dcim-app --format '{{.HostConfig.RestartPolicy.Name}}'); [ -z "$RESTART" -o "$RESTART" = "no" ] && RESTART=unless-stopped
HOSTPORT=$(docker inspect dcim-app --format '{{range $p,$c := .HostConfig.PortBindings}}{{range $c}}{{.HostPort}} {{end}}{{end}}' | awk '{print $1}'); [ -z "$HOSTPORT" ] && HOSTPORT=3000
ENVS=$(docker inspect dcim-app --format '{{range .Config.Env}}{{println .}}{{end}}')
DBURL=$(echo "$ENVS" | grep '^DATABASE_URL=' | cut -d= -f2-)
PROM=$(echo  "$ENVS" | grep '^PROMETHEUS_URL=' | cut -d= -f2-)
NAURL=$(echo "$ENVS" | grep '^NEXTAUTH_URL=' | cut -d= -f2-)
NASEC=$(echo "$ENVS" | grep '^NEXTAUTH_SECRET=' | cut -d= -f2-)

echo "IMG=$IMG"
echo "NET=$NET  PORT=$HOSTPORT  RESTART=$RESTART"
echo "DB=$(echo "$DBURL" | sed 's#:[^:@]*@#:***@#')"
[ -z "$IMG" ] || [ -z "$NET" ] || [ -z "$DBURL" ] && { echo "ERR: IMG/NET/DBURL 중 누락. 중단."; exit 1; }

# 2) env 인자 (있는 것만)
ARGS=(-e "DATABASE_URL=$DBURL" -e "CRON_SECRET=$SECRET")
[ -n "$PROM" ]  && ARGS+=(-e "PROMETHEUS_URL=$PROM")
[ -n "$NAURL" ] && ARGS+=(-e "NEXTAUTH_URL=$NAURL")
[ -n "$NASEC" ] && ARGS+=(-e "NEXTAUTH_SECRET=$NASEC")

# 3) 기존 컨테이너는 rm 대신 백업(rename) → 실패 시 롤백 가능
docker rm dcim-app-prev >/dev/null 2>&1
echo "-- dcim-app 중지 후 백업(rename) → 새로 재생성 --"
docker stop dcim-app >/dev/null
docker rename dcim-app dcim-app-prev

if docker run -d --name dcim-app --network "$NET" -p "${HOSTPORT}:3000" --restart "$RESTART" "${ARGS[@]}" "$IMG" >/dev/null; then
  echo "RUN=OK"
else
  echo "RUN 실패 → 롤백(이전 컨테이너 복구)"
  docker rename dcim-app-prev dcim-app && docker start dcim-app
  exit 1
fi

# 4) 검증
sleep 6
echo "CONTAINER_CRON=$(docker exec dcim-app printenv CRON_SECRET 2>/dev/null | cut -c1-6)..."
CODE=$(curl -s -o /tmp/cf.json -w "%{http_code}" -H "Authorization: Bearer $SECRET" "http://localhost:${HOSTPORT}/api/cron/alert-check" 2>/dev/null)
echo "TEST_HTTP=$CODE"
echo "TEST_BODY=$(head -c 140 /tmp/cf.json 2>/dev/null)"; rm -f /tmp/cf.json
echo "APP_STATE=$(docker inspect dcim-app --format '{{.State.Status}}' 2>/dev/null)"
echo "=== END ==="
# 성공: TEST_HTTP=200 + ok:true, APP_STATE=running.
# 백업 컨테이너 dcim-app-prev 는 정상 확인 후 'docker rm dcim-app-prev'로 정리.
# 문제 시 롤백: docker stop dcim-app && docker rm dcim-app && docker rename dcim-app-prev dcim-app && docker start dcim-app
