#!/bin/bash
# cron secret 수동 적용 + 재기동 실패 원인 진단 (에러를 숨기지 않음)
# 실행: docker-compose.yml 있는 프로젝트 디렉토리에서
#       bash check/targetExecCmd/20260629-cron-apply-debug.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || true
echo "=== CRON_APPLY_DEBUG ==="
echo "PWD=$(pwd)"
echo "COMPOSE_YML=$([ -f docker-compose.yml ] && echo yes || echo NO)"

# 1) compose 명령 탐지 (v2 우선, 없으면 v1)
if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else DC=""; fi
echo "DC=[$DC]"

# 2) 서버의 docker-compose.yml에 CRON_SECRET 전달 라인이 있나 (0이면 최신 파일 미복사)
echo "YML_HAS_CRON=$(grep -c 'CRON_SECRET' docker-compose.yml 2>/dev/null)"

# 3) .env에 CRON_SECRET 있나 (마스킹)
S=$(grep -E '^CRON_SECRET=' .env 2>/dev/null | head -1 | cut -d= -f2-)
echo "ENV_CRON=${S:0:6}... (len=${#S})"

# 4) app 컨테이너 재생성 — 에러를 그대로 출력, 빌드는 시도하지 않음
echo "-- $DC up -d --no-build app (에러 표시) --"
if [ -n "$DC" ]; then
  $DC up -d --no-build app
  echo "EXIT=$?"
else
  echo "ERR: docker compose 명령을 찾지 못함"
fi

# 5) 컨테이너에 secret이 들어갔나
echo "CONTAINER_CRON=$(docker exec dcim-app printenv CRON_SECRET 2>/dev/null | cut -c1-6)..."

# 6) 재테스트 (200 + ok:true 면 성공)
sleep 4
CODE=$(curl -s -o /tmp/ct.json -w "%{http_code}" -H "Authorization: Bearer $S" http://localhost:3000/api/cron/alert-check 2>/dev/null)
echo "TEST_HTTP=$CODE"
echo "TEST_BODY=$(head -c 140 /tmp/ct.json 2>/dev/null)"
rm -f /tmp/ct.json
echo "=== END ==="
# 해석:
#  - YML_HAS_CRON=0 → 서버 docker-compose.yml이 옛 버전. 최신 파일 복사 후 재실행 필요.
#  - DC=[] → docker compose 명령 미발견(환경/PATH).
#  - up 단계 에러 메시지 → 그대로 알려주세요.
