#!/bin/bash
# 2026-06-09: Lab-3 확장 사전 확인
# 목적: Lab-3 타겟이 Lab-1 Prometheus에서 조회되는지, instance 형식/라벨 확인
# 실행: bash check/targetExecCmd/20260609.sh

PROM="http://10.144.38.100:30003"

echo "=== 1. Lab-3 node-exporter 타겟 ==="
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=[x for x in d['data']['activeTargets'] if '131.' in x['labels'].get('instance','')]
print(f'count: {len(t)}')
for x in t[:3]:
    print(f\"  {x['labels'].get('instance','')} job={x['labels'].get('job','')} health={x['health']}\")
if len(t)>3: print(f'  ...and {len(t)-3} more')
"

echo ""
echo "=== 2. Lab-3 cAdvisor 타겟 ==="
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=[x for x in d['data']['activeTargets'] if x['labels'].get('job','')=='kubernetes-cadvisor' and '131' in x['labels'].get('instance','')]
print(f'count: {len(t)}')
for x in t[:3]:
    print(f\"  {x['labels'].get('instance','')} health={x['health']}\")
if len(t)>3: print(f'  ...and {len(t)-3} more')
"

echo ""
echo "=== 3. Lab-3 PCM 타겟 ==="
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=[x for x in d['data']['activeTargets'] if 'PCM' in x['labels'].get('job','') and '131' in x['labels'].get('instance','')]
print(f'count: {len(t)}')
for x in t[:3]:
    print(f\"  {x['labels'].get('instance','')} job={x['labels'].get('job','')} health={x['health']}\")
if len(t)>3: print(f'  ...and {len(t)-3} more')
"

echo ""
echo "=== 4. Lab-3 CPU 메트릭 샘플 ==="
curl -sg "$PROM/api/v1/query?query=count(node_cpu_seconds_total{mode=\"idle\",instance=~\"10.144.131.*\"})" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'Lab-3 CPU cores (node-exporter): {r[0][\"value\"][1] if r else \"NO DATA\"}')" 2>/dev/null

echo ""
echo "=== 5. Lab-3 up 상태 요약 ==="
curl -sg "$PROM/api/v1/query?query=count by (job) (up{instance=~\".*131.*\"}==1)" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('NO Lab-3 targets found')
for x in sorted(r, key=lambda x: x['metric'].get('job','')):
    print(f\"  {x['metric'].get('job','')}: {x['value'][1]} up\")" 2>/dev/null

echo ""
echo "=== 6. DB 등록 현황 ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -t -c "
SELECT 'lab1: ' || count(*) FILTER (WHERE \"ipAddress\" LIKE '10.144.38.%')
    || '  lab3: ' || count(*) FILTER (WHERE \"ipAddress\" LIKE '10.144.131.%')
    || '  no-ip: ' || count(*) FILTER (WHERE \"ipAddress\" IS NULL OR \"ipAddress\" = '')
    || '  total: ' || count(*)
FROM \"Equipment\";"
