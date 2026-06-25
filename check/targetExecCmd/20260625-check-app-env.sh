#!/bin/bash
# 앱 실행 환경 확인
# 실행: bash check/targetExecCmd/20260625-check-app-env.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

echo "=== E1. Docker 컨테이너 목록 ==="
docker ps --format "{{.Names}}" 2>/dev/null || echo "docker 없음"

echo "=== E2. Node.js 프로세스 ==="
pgrep -a node 2>/dev/null | head -3 || echo "node 프로세스 없음"

echo "=== E3. npx tsx 가능 여부 ==="
which npx 2>/dev/null && npx tsx --version 2>/dev/null | head -1 || echo "npx 없음"

echo "=== E4. BMC 환경변수 ==="
echo "BMC_USER=$([ -n \"$BMC_USERNAME\" ] && echo 'SET' || echo 'UNSET')"
echo "BMC_PASS=$([ -n \"$BMC_PASSWORD\" ] && echo 'SET' || echo 'UNSET')"

echo "=== E5. .env BMC 설정 ==="
grep -c "BMC_" .env 2>/dev/null || echo ".env 없음"

echo "=== 완료 ==="
