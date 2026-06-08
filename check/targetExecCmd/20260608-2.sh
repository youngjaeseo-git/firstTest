#!/bin/bash
# 2026-06-08 (2): DCIM→Prometheus 연결 상세 진단
# 502 에러 원인 추적

echo "=== 1. 현재 PROMETHEUS_URL 환경변수 ==="
echo "${PROMETHEUS_URL:-설정안됨(기본값 10.100.175.248:8080 사용)}"

echo "=== 2. 앱 프로세스의 환경변수 ==="
NEXT_PID=$(pgrep -f "next-server" | head -1)
if [ -n "$NEXT_PID" ]; then
  cat /proc/$NEXT_PID/environ 2>/dev/null | tr '\0' '\n' | grep -i PROM || echo "PROMETHEUS 변수 없음"
else
  echo "next-server 프로세스 못 찾음"
fi

echo "=== 3. 앱에서 Prometheus 연결 테스트 ==="
curl -s -o /dev/null -w "code:%{http_code} time:%{time_total}s" "http://10.100.175.248:8080/api/v1/query?query=up" 2>/dev/null
echo ""

echo "=== 4. DNS/네트워크 ==="
ping -c 1 -W 2 10.100.175.248 2>/dev/null | head -2

echo "=== 5. .env 파일 PROMETHEUS 관련 ==="
grep -i "PROMETHEUS\|NEXTAUTH" .env .env.local 2>/dev/null || echo "관련 설정 없음"

echo "=== 6. server-start.sh에서 export 확인 ==="
grep -i "PROMETHEUS" server-start.sh 2>/dev/null || echo "server-start.sh에 PROMETHEUS 없음"
