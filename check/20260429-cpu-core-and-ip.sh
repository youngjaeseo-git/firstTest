#!/bin/bash
# CPU 코어별 데이터 + IP 스크립트 디버깅
# 사용법: bash check/20260429-cpu-core-and-ip.sh > cpu-ip-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== 1. cpu 라벨 값 확인 ==="
curl -s --connect-timeout 5 --get \
  --data-urlencode "query=count by(cpu)(container_cpu_usage_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"})" \
  "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'  result count: {len(r)}')
for x in r[:20]:
  cpu=x.get('metric',{}).get('cpu','?')
  cnt=x.get('value',['',''])[1]
  print(f'  cpu={cpu} count={cnt}')
" 2>/dev/null
echo ""

echo "=== 2. sum by(cpu) rate 결과 (상위 5개) ==="
curl -s --connect-timeout 5 --get \
  --data-urlencode "query=topk(5, sum by(cpu)(rate(container_cpu_usage_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m])) * 100)" \
  "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'  result count: {len(r)}')
for x in r:
  cpu=x.get('metric',{}).get('cpu','?')
  val=x.get('value',['',''])[1]
  print(f'  cpu={cpu} val={val}')
" 2>/dev/null
echo ""

echo "=== 3. cpu 라벨 없이 per-core 가능한지 ==="
curl -s --connect-timeout 5 --get \
  --data-urlencode "query=count(container_cpu_usage_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\",cpu!=\"total\"})" \
  "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r:
  print(f'  cpu!=total count: {r[0].get(\"value\",[\"\",\"\"])[1]}')
else:
  print('  X empty (no per-core data without total)')
" 2>/dev/null
echo ""

echo "=== 4. IP 디버깅 - targets API 원본 ==="
curl -s --connect-timeout 5 "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.load(sys.stdin)
active=d.get('data',{}).get('activeTargets',[])
print(f'  total activeTargets: {len(active)}')
found=0
for t in active:
  inst=t.get('labels',{}).get('instance','')
  if '${INST}' in inst:
    found+=1
    job=t.get('labels',{}).get('job','?')
    scrape=t.get('scrapeUrl','?')
    print(f'  job={job}')
    print(f'    scrapeUrl={scrape}')
    dl=t.get('discoveredLabels',{})
    addr=dl.get('__address__','N/A')
    print(f'    __address__={addr}')
if found==0:
  print('  X no targets found for ${INST}')
  print('  showing first 3 instances:')
  for t in active[:3]:
    print(f'    {t.get(\"labels\",{}).get(\"instance\",\"?\")}')
" 2>/dev/null
echo ""

echo "=== 완료 ==="
