#!/bin/bash
# s121x13ae013의 PCM 메트릭 중 IPC 관련 이름 확인
# 실행: bash check/20260521-pcm-ipc-check.sh

PROM=http://10.100.175.248:8080
HOST="s121x13ae013"

echo "=== IPC 관련 메트릭 ==="
curl -s "$PROM/api/v1/query" --data-urlencode "query={instance=~\"${HOST}(:.*)?\",job!~\"kubernetes.*|node-exporter|kube.*\"}" | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
names=sorted(set(item['metric'].get('__name__','?') for item in r))
kw=['instruct','clock','ipc','retire','cycle','unhalted','tsc','cache','hit','miss','l2','l3','dram','read','write']
for n in names:
    if any(w in n.lower() for w in kw):
        print(n)
print(f'---')
print(f'filtered: {sum(1 for n in names if any(w in n.lower() for w in kw))} / total: {len(names)}')
"
