#!/bin/bash
# node-exporter 배포 확인 스크립트
# 실행: bash check/20260506-node-exporter-deploy.sh

echo "=== 1. DaemonSet 상태 ==="
kubectl -n monitoring get daemonset node-exporter 2>&1 | head -5

echo ""
echo "=== 2. Pod 상태 (node-exporter) ==="
kubectl -n monitoring get pods -l app=node-exporter -o wide 2>&1 | head -10

echo ""
echo "=== 3. node-exporter 직접 접근 테스트 (localhost:9100) ==="
curl -s --max-time 3 http://localhost:9100/metrics 2>&1 | head -3

echo ""
echo "=== 4. Prometheus에서 node-exporter job 확인 ==="
curl -s 'http://10.100.175.248:8080/api/v1/query?query=up{job="node-exporter"}' 2>&1 | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  results=d.get('data',{}).get('result',[])
  print(f'Targets found: {len(results)}')
  for r in results[:3]:
    print(f\"  {r['metric'].get('instance','?')} = {r['value'][1]}\")
except: print('Parse error or no response')
"

echo ""
echo "=== 5. 샘플 메트릭 (CPU seconds) ==="
curl -s 'http://10.100.175.248:8080/api/v1/query?query=node_cpu_seconds_total{mode="idle"}' 2>&1 | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  results=d.get('data',{}).get('result',[])
  print(f'Series count: {len(results)}')
  if results:
    print(f'Sample labels: {list(results[0][\"metric\"].keys())}')
except: print('No data yet')
"
