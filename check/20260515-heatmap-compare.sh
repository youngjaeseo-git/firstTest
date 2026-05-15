#!/bin/bash
# s222hax14ae011 vs s222hax14ae012 히트맵 비교 진단
# 실행: bash check/20260515-heatmap-compare.sh

PROM=http://10.100.175.248:8080
S1=s222hax14ae011
S2=s222hax14ae012

echo "=== 1. 두 서버의 Prometheus 타겟 확인 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for s in ['$S1','$S2']:
    targets = [t for t in d['data']['activeTargets'] if s in str(t.get('labels',{}))]
    print(f'  {s}: {len(targets)} targets')
    for t in targets:
        inst = t['labels'].get('instance','?')
        job = t['labels'].get('job','?')
        h = t['health']
        print(f'    job={job} instance={inst} health={h}')
"

echo ""
echo "=== 2. node-exporter per-core 데이터 확인 ==="
for S in $S1 $S2; do
  echo "  --- $S (hostname match) ---"
  curl -s "$PROM/api/v1/query" --data-urlencode "query=count(node_cpu_seconds_total{mode=\"idle\",instance=~\"${S}(:.*)?\",job=\"node-exporter\"})" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print('    cores=' + (r[0]['value'][1] if r else 'NONE'))
"
done

echo ""
echo "=== 3. cAdvisor per-cpu 데이터 확인 ==="
for S in $S1 $S2; do
  echo "  --- $S ---"
  curl -s "$PROM/api/v1/query" --data-urlencode "query=count(rate(container_cpu_usage_seconds_total{instance=~\"${S}(:.*)?\",container!=\"\",cpu!=\"total\"}[5m]))" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print('    cpu_series=' + (r[0]['value'][1] if r else 'NONE'))
"
done

echo ""
echo "=== 4. 두 서버의 up 메트릭 (어떤 job이 있는지) ==="
for S in $S1 $S2; do
  echo "  --- $S ---"
  curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${S}(.*)\"}" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('    NOT_FOUND')
for item in r:
    inst = item['metric'].get('instance','?')
    job = item['metric'].get('job','?')
    up = item['value'][1]
    print(f'    job={job} instance={inst} up={up}')
"
done

echo ""
echo "=== 5. node-exporter IP로 재시도 (IP가 다를 수 있음) ==="
echo "  node-exporter target IPs containing 222:"
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = [t for t in d['data']['activeTargets'] if t['labels'].get('job')=='node-exporter']
for t in targets:
    inst = t['labels'].get('instance','')
    if '222' in inst or 'ae011' in inst or 'ae012' in inst:
        print(f'  {inst} health={t[\"health\"]}')
# Also show total count
print(f'  (total node-exporter targets: {len(targets)})')
"
