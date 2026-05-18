#!/bin/bash
# PCM 실제 메트릭 이름 + 샘플값 확인
# 실행: bash check/20260519-pcm-actual-names.sh

PROM=http://10.100.175.248:8080
INST="s222hax14ae011"

echo "=== PCM 메트릭 카테고리별 분류 (이름 패턴) ==="
curl -s "$PROM/api/v1/query" --data-urlencode "query={instance=~\"${INST}(.*)\"}" | python3 -c "
import sys, json
from collections import defaultdict

d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])

metrics = {}
for item in r:
    name = item['metric'].get('__name__','?')
    job = item['metric'].get('job','?')
    val = item['value'][1]
    if name not in metrics:
        metrics[name] = {'job': job, 'val': val, 'labels': {}}
        for k,v in item['metric'].items():
            if k not in ('__name__','job','instance'):
                metrics[name]['labels'][k] = v

# Group by keyword
groups = defaultdict(list)
for name, info in sorted(metrics.items()):
    lower = name.lower()
    if any(w in lower for w in ['cpu','core','ipc','instruction','cycle']):
        groups['CPU'].append((name, info))
    elif any(w in lower for w in ['mem','dram','dimm','ram']):
        groups['Memory'].append((name, info))
    elif any(w in lower for w in ['cache','l2','l3']):
        groups['Cache'].append((name, info))
    elif any(w in lower for w in ['pcie','pci','bandwidth','bw']):
        groups['PCIe/BW'].append((name, info))
    elif any(w in lower for w in ['power','joule','watt','energy','thermal','temp']):
        groups['Power/Thermal'].append((name, info))
    elif any(w in lower for w in ['disk','io','read','write','nvme','ssd']):
        groups['Disk/IO'].append((name, info))
    elif any(w in lower for w in ['net','rx','tx','packet','socket']):
        groups['Network'].append((name, info))
    else:
        groups['Other'].append((name, info))

for group in ['CPU','Memory','Cache','PCIe/BW','Power/Thermal','Disk/IO','Network','Other']:
    items = groups.get(group, [])
    if not items:
        continue
    print(f'\n--- {group} ({len(items)}) ---')
    for name, info in items[:10]:
        lbl = ', '.join(f'{k}={v}' for k,v in list(info['labels'].items())[:3])
        print(f'  {name} = {info[\"val\"]}  [{info[\"job\"]}] {lbl}')
    if len(items) > 10:
        print(f'  ... +{len(items)-10} more')

print(f'\nTOTAL: {len(metrics)} unique metrics')
"
