#!/bin/bash
# s222hax14ae011의 PCM 메트릭 전체 확인
# 실행: bash check/20260519-pcm-metrics.sh

PROM=http://10.100.175.248:8080
INST="s222hax14ae011"

echo "=== 1. 이 서버의 PCM job 확인 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for t in d['data']['activeTargets']:
    if '${INST}' in str(t.get('labels',{})):
        job = t['labels'].get('job','?')
        if 'PCM' in job.upper() or 'Dell' in job:
            print(f'  job={job} instance={t[\"labels\"].get(\"instance\",\"?\")} health={t[\"health\"]}')
"

echo ""
echo "=== 2. PCM 메트릭 이름 목록 (이 서버) ==="
curl -s "$PROM/api/v1/query" --data-urlencode "query={instance=~\"${INST}(.*)\"}" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
names = sorted(set(item['metric'].get('__name__','?') for item in r))
for n in names:
    print(f'  {n}')
print(f'  TOTAL: {len(names)} metrics')
"

echo ""
echo "=== 3. PCM CPU 관련 메트릭 샘플값 (있다면) ==="
for m in IPC L2_Cache_Hit L3_Cache_Hit Memory_Bandwidth_Total QPI_Bandwidth PCIe_Bandwidth Instructions_Retired Cycles; do
  VAL=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=${m}{instance=~\"${INST}(.*)\"}" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print(r[0]['value'][1] if r else 'NO_DATA')
" 2>/dev/null)
  echo "  ${m}: ${VAL}"
done
