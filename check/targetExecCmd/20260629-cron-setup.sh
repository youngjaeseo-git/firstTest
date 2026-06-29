#!/bin/bash
# 알림/만료 cron 설정 — CRON_SECRET 주입 + 컨테이너 재기동 + crontab 등록 + 검증
# 실행: docker 호스트(38.100 서버)에서, bash check/targetExecCmd/20260629-cron-setup.sh
# 전제: 최신 docker-compose.yml(CRON_SECRET 전달 추가본)이 서버에 반영돼 있어야 함
set -u
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

ENVF=".env"
APP_URL="http://localhost:3000"
DC="docker compose"; command -v docker >/dev/null && docker compose version >/dev/null 2>&1 || DC="docker-compose"

echo "=== CRON_SETUP ==="

# 1) CRON_SECRET 가져오거나 생성
SECRET=$(grep -E '^CRON_SECRET=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2-)
if [ -z "$SECRET" ]; then
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)
  fi
  [ -f "$ENVF" ] || touch "$ENVF"
  printf '\nCRON_SECRET=%s\n' "$SECRET" >> "$ENVF"
  echo "SECRET=생성됨(.env에 추가) ${SECRET:0:6}..."
  NEED_RESTART=1
else
  echo "SECRET=기존값 사용 ${SECRET:0:6}..."
  NEED_RESTART=0
fi

# 2) 컨테이너가 CRON_SECRET을 갖고 있는지 확인, 없으면 재기동
INCONT=$(docker exec dcim-app printenv CRON_SECRET 2>/dev/null)
if [ "$INCONT" != "$SECRET" ] || [ "$NEED_RESTART" = "1" ]; then
  echo "-- app 컨테이너 재기동(새 env 적용) --"
  $DC up -d app >/dev/null 2>&1 && echo "재기동 OK" || echo "재기동 실패: 수동으로 '$DC up -d app' 필요"
  sleep 5
fi

# 3) crontab 등록 (기존 동일 항목 제거 후 재등록 — 멱등)
CUR=$(crontab -l 2>/dev/null | grep -v 'cron/alert-check' | grep -v 'cron/expiry-check')
{
  echo "$CUR"
  echo "*/5 * * * * curl -fsS -H \"Authorization: Bearer $SECRET\" $APP_URL/api/cron/alert-check >/dev/null 2>&1"
  echo "0 8 * * * curl -fsS -H \"Authorization: Bearer $SECRET\" $APP_URL/api/cron/expiry-check >/dev/null 2>&1"
} | crontab -
echo "CRON_LINES=$(crontab -l 2>/dev/null | grep -c 'cron/')"

# 4) 즉시 검증 (alert-check 1회 호출)
CODE=$(curl -s -o /tmp/cron_test.json -w "%{http_code}" -H "Authorization: Bearer $SECRET" "$APP_URL/api/cron/alert-check" 2>/dev/null)
echo "TEST_HTTP=$CODE"
echo "TEST_BODY=$(head -c 160 /tmp/cron_test.json 2>/dev/null)"
rm -f /tmp/cron_test.json
echo "=== END ==="
# 해석: TEST_HTTP=200 이고 BODY에 \"ok\":true 면 성공.
#       503=CRON_SECRET 미적용(재기동 필요), 401=secret 불일치
