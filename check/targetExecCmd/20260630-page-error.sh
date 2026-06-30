#!/bin/bash
# capacity/reports 크래시의 "실제 에러 메시지" 추출 + 배포 반영 확인
# 사용법: ① 브라우저로 /capacity, /reports 를 한 번 열어 에러 발생 → ② 이 스크립트 실행
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." 2>/dev/null || true
echo "=== PAGE_ERROR_DIAG ==="

echo "-- [1] 서버 소스에 내 수정 반영됐나 --"
echo "reports_fix(ruleId:true)=$(grep -c 'ruleId: true' 'src/app/(dashboard)/reports/page.tsx' 2>/dev/null)"
echo "capacity_guard(try/catch)=$(grep -c 'Capacity page DB query failed' 'src/app/(dashboard)/capacity/page.tsx' 2>/dev/null)"
echo "head=$(git log -1 --format='%h %s' 2>/dev/null | cut -c1-50)"

echo "-- [2] 실제 에러 (dcim 로그 최근 200줄에서 추출) --"
LOG=$( (journalctl -u dcim -n 200 --no-pager 2>/dev/null) || (sudo journalctl -u dcim -n 200 --no-pager 2>/dev/null) || (journalctl --user -u dcim -n 200 --no-pager 2>/dev/null) )
if [ -z "$LOG" ]; then echo "  (journalctl 접근 실패 — 'sudo journalctl -u dcim -n 80' 수동 확인 필요)"; fi
echo "$LOG" | grep -iE "⨯|Error:|PrismaClient|Unhandled|TypeError|Cannot read|is not a function|is not defined|undefined \(reading|/capacity|/reports|at Capacity|at Reports" | tail -20

echo "=== END ==="
# [1] 둘 다 1 이어야 내 수정이 반영된 것. 0이면 소스 미복사/구버전.
# [2] 의 'Error: ...' 줄과 'at ...' 첫 스택 1~2줄을 알려주세요 — 그게 진짜 원인입니다.
