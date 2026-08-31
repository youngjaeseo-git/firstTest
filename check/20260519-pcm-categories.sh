#!/bin/bash
# PCM 메트릭 카테고리별 개수 + 대표 이름 2개씩
# 실행: bash check/20260519-pcm-categories.sh

PROM=http://10.100.175.248:8080

curl -s "$PROM/api/v1/query" --data-urlencode 'query={job="AE-SMC-GNRAP_PCM"}' | python3 -c "
import sys, json
from collections import defaultdict
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
names = sorted(set(item['metric'].get('__name__','?') for item in r))
g = defaultdict(list)
for n in names:
    low = n.lower()
    if any(w in low for w in ['joule','power','watt','energy']):
        g['Power'].append(n)
    elif any(w in low for w in ['dram','mem','read','write','pmm']):
        g['Memory'].append(n)
    elif any(w in low for w in ['cache','l2','l3','hit','miss']):
        g['Cache'].append(n)
    elif any(w in low for w in ['ipc','instruct','cycle','exec','core','cpu','retire','cstate']):
        g['CPU'].append(n)
    elif any(w in low for w in ['pcie','cxl','link','traffic','bandwidth','bw','upi','qpi']):
        g['Interconnect'].append(n)
    else:
        g['Other'].append(n)
for cat in ['CPU','Memory','Cache','Power','Interconnect','Other']:
    items = g.get(cat,[])
    if not items:
        continue
    sample = ', '.join(items[:2])
    print(f'{cat}({len(items)}): {sample}')
"
