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

echo ""
echo "=== 8. 전체 node-exporter UP/DOWN 상태 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{job="node-exporter"}' | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
for item in sorted(r, key=lambda x: x['metric']['instance']):
    inst=item['metric']['instance']
    val=item['value'][1]
    status='UP' if val=='1' else 'DOWN'
    print(f'  {inst:30s} {status}')
if not r: print('  NO DATA')
"

echo ""
echo "=== 9. 전체 cAdvisor UP/DOWN 상태 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{job="kubernetes-cadvisor"}' | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
for item in sorted(r, key=lambda x: x['metric']['instance']):
    inst=item['metric']['instance']
    val=item['value'][1]
    status='UP' if val=='1' else 'DOWN'
    print(f'  {inst:30s} {status}')
if not r: print('  NO DATA')
"

echo ""
echo "=== 10. Prometheus scrape 에러 (node-exporter) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
ne=[t for t in targets if t.get('labels',{}).get('job')=='node-exporter']
for t in sorted(ne, key=lambda x: x['labels'].get('instance','')):
    inst=t['labels'].get('instance','?')
    health=t.get('health','?')
    err=t.get('lastError','')
    print(f'  {inst:30s} {health:5s}  {err[:60] if err else \"\"}')
if not ne: print('  NO node-exporter targets')
"

echo ""
echo "=== 11. NE 중복 원인: hostname instance가 있는 job 확인 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{instance=~"s121x13ae015.*"}' | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
for item in r:
    print(f'  job={item[\"metric\"].get(\"job\",\"?\")} instance={item[\"metric\"][\"instance\"]} up={item[\"value\"][1]}')
if not r: print('  NO DATA')
"

echo ""
echo "=== 12. timeout 서버 직접 curl 테스트 (013, 061) ==="
echo "013:"
timeout 3 curl -s -o /dev/null -w "status=%{http_code} time=%{time_total}s" http://10.144.38.113:9100/metrics 2>&1 || echo "TIMEOUT/FAIL"
echo ""
echo "061:"
timeout 3 curl -s -o /dev/null -w "status=%{http_code} time=%{time_total}s" http://10.144.38.61:9100/metrics 2>&1 || echo "TIMEOUT/FAIL"
