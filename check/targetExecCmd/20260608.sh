#!/bin/bash
# 2026-06-08: Prometheus 연결 진단
# DCIM 앱에서 모든 메트릭 차트가 "Prometheus data unavailable" 표시되는 문제

echo "=== 1. Prometheus 직접 연결 ==="
curl -s -o /dev/null -w "HTTP %{http_code} (%{time_total}s)" http://10.100.175.248:8080/api/v1/status/config 2>/dev/null
echo ""

echo "=== 2. 간단한 쿼리 테스트 ==="
curl -s "http://10.100.175.248:8080/api/v1/query?query=up" 2>/dev/null | head -c 200
echo ""

echo "=== 3. DCIM 앱 API 테스트 ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/api/metrics/range?query=up\&duration=5\&step=60s 2>/dev/null
echo ""

echo "=== 4. DCIM 앱에서 Prometheus로 ==="
curl -s "http://localhost:3000/api/metrics/range?query=up&duration=5&step=60s" 2>/dev/null | head -c 300
echo ""

echo "=== 5. 환경변수 확인 ==="
grep -i "PROMETHEUS" .env .env.local 2>/dev/null || echo "(env 파일에 PROMETHEUS 설정 없음)"
echo ""

echo "=== 6. 프로세스 확인 ==="
ps aux | grep -E "next|node" | grep -v grep | wc -l
echo "개 node/next 프로세스"
