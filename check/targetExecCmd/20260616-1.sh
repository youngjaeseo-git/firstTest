#!/bin/bash
# DCIM 앱 실행 방식 확인 (38.100)

echo "=== 1. Node.js 프로세스 ==="
ps aux | grep -E "node|next|npm" | grep -v grep | head -5

echo ""
echo "=== 2. 3000 포트 사용 프로세스 ==="
ss -tlnp | grep 3000

echo ""
echo "=== 3. pm2 목록 ==="
pm2 list 2>/dev/null || echo "pm2 없음"

echo ""
echo "=== 4. 프로젝트 경로 ==="
ls -d /home/*/firstTest /root/firstTest /opt/firstTest 2>/dev/null | head -3
pwd
