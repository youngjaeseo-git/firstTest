#!/bin/bash
# node-exporter 응답 시간 테스트 — 타임아웃 문제 확인
# 실행: bash check/20260514-node-exporter-timeout-test.sh

echo "=== node-exporter 응답 시간 테스트 (타임아웃 30초) ==="
echo ""

for IP in 10.144.38.103 10.144.38.61 10.144.38.81; do
  echo "--- $IP:9100 ---"

  # 1. 루트 페이지 (가벼운 요청)
  CODE=$(curl -s --connect-timeout 5 -m 10 -o /dev/null -w "%{http_code}" "http://$IP:9100/" 2>/dev/null)
  echo "  / (root):     HTTP $CODE"

  # 2. /metrics (무거운 요청, 타임아웃 30초)
  START=$(date +%s%N)
  CODE=$(curl -s --connect-timeout 5 -m 30 -o /dev/null -w "%{http_code}" "http://$IP:9100/metrics" 2>/dev/null)
  END=$(date +%s%N)
  ELAPSED=$(( (END - START) / 1000000 ))
  echo "  /metrics:     HTTP $CODE (${ELAPSED}ms)"

  # 3. 메트릭 응답 크기
  if [ "$CODE" = "200" ]; then
    SIZE=$(curl -s --connect-timeout 5 -m 30 "http://$IP:9100/metrics" 2>/dev/null | wc -c)
    echo "  Response size: ${SIZE} bytes"
  fi

  echo ""
done

echo "=== Prometheus scrape 설정 확인 ==="
PROM=http://10.100.175.248:8080
curl -s "$PROM/api/v1/status/config" | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
config=d.get('data',{}).get('yaml','')
lines=config.split('\n')
in_ne=False
for line in lines:
    if 'node-exporter' in line:
        in_ne=True
    if in_ne:
        print('  ' + line)
        if line.strip().startswith('- job_name') and 'node-exporter' not in line:
            break
" 2>/dev/null
