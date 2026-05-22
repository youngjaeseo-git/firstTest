#!/bin/bash
# 2026-05-22 실행 스크립트
# 실행: bash check/targetExecCmd/20260522.sh

PROM=http://10.100.175.248:8080

echo "=== 6. Fleet TOP CPU instance 값 확인 (중복 디버깅) ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=topk(10, (1 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100)' | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
print('node-exporter:')
for item in sorted(r, key=lambda x: -float(x['value'][1]))[:5]:
    print(f'  {item[\"metric\"][\"instance\"]} = {float(item[\"value\"][1]):.1f}%')
"

echo ""
curl -s "$PROM/api/v1/query" --data-urlencode 'query=topk(10, sum by(instance)(rate(container_cpu_usage_seconds_total{container!=""}[5m])) / on(instance) group_left() machine_cpu_cores * 100)' | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
print('cAdvisor:')
for item in sorted(r, key=lambda x: -float(x['value'][1]))[:5]:
    print(f'  {item[\"metric\"][\"instance\"]} = {float(item[\"value\"][1]):.1f}%')
"

echo ""
echo "=== 7. 013 node-exporter UP 상태 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{instance=~"10.144.38.113.*"}' | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
for item in r:
    print(f'  job={item[\"metric\"].get(\"job\",\"?\")} instance={item[\"metric\"][\"instance\"]} up={item[\"value\"][1]}')
if not r: print('  NO DATA')
"
