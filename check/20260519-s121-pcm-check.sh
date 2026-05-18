#!/bin/bash
# s121x13ae013 PCM + 전체 상태 확인
# 실행: bash check/20260519-s121-pcm-check.sh

PROM=http://10.100.175.248:8080
IP="10.144.38.113"
HOST="s121x13ae013"

echo "=== Status ==="
echo -n "NE UP: "
curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${IP}(:.*)?\",job=\"node-exporter\"}" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else 'NO')" 2>/dev/null
echo -n "cAdvisor UP: "
curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${HOST}(:.*)?\",job=\"kubernetes-cadvisor\"}" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else 'NO')" 2>/dev/null

echo ""
echo "=== PCM jobs for this server ==="
curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${HOST}(.*)\"}" | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
for item in r:
    m=item['metric']
    job=m.get('job','?')
    inst=m.get('instance','?')
    val=item['value'][1]
    if 'cadvisor' not in job and 'node' not in job and 'kube' not in job:
        print(f'  {job} inst={inst} up={val}')
" 2>/dev/null

echo ""
echo "=== PCM metric names (non-cAdvisor, non-node-exporter) ==="
curl -s "$PROM/api/v1/query" --data-urlencode "query={instance=~\"${HOST}(:.*)?\",job!~\"kubernetes.*|node-exporter|kube.*\"}" | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
names=sorted(set(item['metric'].get('__name__','?') for item in r))
for n in names:
    print(f'  {n}')
print(f'TOTAL: {len(names)}')
" 2>/dev/null
