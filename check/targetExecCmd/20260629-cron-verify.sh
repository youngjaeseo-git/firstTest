#!/bin/bash
# cron 검증 (재시작 안 함) — next dev 컴파일 유발 후 cron 엔드포인트 테스트
# 실행: bash check/targetExecCmd/20260629-cron-verify.sh
cd "$(dirname "$0")/../.." 2>/dev/null || true
echo "=== CRON_VERIFY (no restart) ==="
echo "svc_active=$(systemctl is-active dcim 2>/dev/null)"
echo "db=$(docker compose ps db 2>/dev/null | grep -o healthy | head -1)  app_db_port=$(docker compose port db 5432 2>/dev/null)"

echo "-- 첫 요청으로 dev 컴파일 유발(최대 90s 대기) --"
curl -s -o /dev/null --max-time 90 http://localhost:3000 2>/dev/null
echo "HTTP_3000=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:3000 2>/dev/null)"

S=$(grep -E '^CRON_SECRET=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
CODE=$(curl -s -o /tmp/cv.json -w '%{http_code}' --max-time 60 -H "Authorization: Bearer $S" http://localhost:3000/api/cron/alert-check 2>/dev/null)
echo "CRON_HTTP=$CODE"
echo "CRON_BODY=$(head -c 160 /tmp/cv.json 2>/dev/null)"; rm -f /tmp/cv.json
echo "=== END ==="
# HTTP_3000=200/307 이면 앱 정상. CRON_HTTP=200 + ok:true 면 cron 완료.
