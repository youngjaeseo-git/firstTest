#!/bin/bash
# 알림 cron 정상화 (실제 운영 = systemd 'dcim' + 호스트 postgres, docker 아님)
# next dev가 .env를 자동 로드하므로, .env의 CRON_SECRET을 반영하려면 서비스 재시작만 하면 됨.
# 실행: bash check/targetExecCmd/20260629-cron-restart.sh  (권한 필요시 sudo로)
cd "$(dirname "$0")/../.." 2>/dev/null || true
echo "=== CRON_RESTART (systemd dcim) ==="

# 1) .env에 CRON_SECRET (정확한 키) 확인
S=$(grep -E '^CRON_SECRET=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
if [ -z "$S" ]; then
  echo "ERR: .env에 'CRON_SECRET=' 키가 없음(또는 오타). 현재 매칭:"; grep -nE 'CRON|CON_SECRET' .env 2>/dev/null
  exit 1
fi
echo "ENV_CRON=${S:0:6}... (len=${#S})"

# 2) dcim 서비스 재시작 (system → sudo → user 순으로 시도)
echo "-- restart dcim (앱 20~40s 잠깐 끊김) --"
if systemctl restart dcim 2>/dev/null; then echo "restart=OK"
elif sudo systemctl restart dcim 2>/dev/null; then echo "restart=OK(sudo)"
elif systemctl --user restart dcim 2>/dev/null; then echo "restart=OK(user)"
else echo "restart 실패 — 수동: sudo systemctl restart dcim"; fi

# 3) 기동 대기 후 테스트 (next dev는 첫 컴파일이 느릴 수 있음)
echo "-- 기동 대기(25s) --"; sleep 25
CODE=$(curl -s -o /tmp/cr.json -w "%{http_code}" -H "Authorization: Bearer $S" http://localhost:3000/api/cron/alert-check 2>/dev/null)
echo "TEST_HTTP=$CODE"
echo "TEST_BODY=$(head -c 160 /tmp/cr.json 2>/dev/null)"; rm -f /tmp/cr.json
echo "=== END ==="
# 200 + \"ok\":true → 성공(기존 crontab이 5분마다 알림 평가).
# 여전히 503 → next dev가 .env 미로드. 플랜B: service-start.sh에 'export CRON_SECRET=...' 추가 후 재시작.
