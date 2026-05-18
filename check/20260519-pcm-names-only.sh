#!/bin/bash
# PCM job 전용 메트릭 이름만 출력 (값/라벨 제외)
# 실행: bash check/20260519-pcm-names-only.sh

PROM=http://10.100.175.248:8080

echo "=== AE-SMC_GNRAP_PCM job 메트릭 이름 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query={job="AE-SMC_GNRAP_PCM",instance="s222hax14ae011"}' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
names = sorted(set(item['metric'].get('__name__','?') for item in r))
for n in names:
    print(n)
print(f'---')
print(f'TOTAL: {len(names)}')
"
