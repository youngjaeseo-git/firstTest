#!/bin/bash
# 파일시스템 메트릭 존재 여부 점검
# 목적: 어떤 node-exporter 타겟에 filesystem 메트릭이 있고 없는지 확인
PROM="http://10.100.175.248:8080"

echo "=== 1. node-exporter UP 타겟 목록 ==="
curl -s "$PROM/api/v1/query?query=up{job=\"node-exporter\"}==1" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(','.join(sorted(set(r['metric']['instance'] for r in d['data']['result']))))" 2>/dev/null

echo ""
echo "=== 2. node_filesystem_size_bytes 있는 타겟 ==="
curl -s "$PROM/api/v1/query?query=count(node_filesystem_size_bytes)by(instance)" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(','.join(sorted(r['metric']['instance'] for r in d['data']['result'])))" 2>/dev/null

echo ""
echo "=== 3. UP이지만 filesystem 없는 타겟 ==="
curl -s "$PROM/api/v1/query?query=up{job=\"node-exporter\"}==1%20unless%20on(instance)%20count(node_filesystem_size_bytes)by(instance)" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);r=d['data']['result'];print(','.join(sorted(x['metric']['instance'] for x in r)) if r else 'NONE(모두있음)')" 2>/dev/null

echo ""
echo "=== 4. filesystem 샘플 (1개 타겟, fstype+mountpoint) ==="
curl -s "$PROM/api/v1/query?query=node_filesystem_size_bytes{fstype!~\"tmpfs|devtmpfs|overlay|squashfs|proc|sysfs|autofs|rootfs\"}" | \
  python3 -c "
import sys,json
d=json.load(sys.stdin)
seen=set()
for r in d['data']['result']:
    inst=r['metric']['instance']
    if inst not in seen:
        seen.add(inst)
        print(f\"{inst} | {r['metric'].get('fstype','?')} | {r['metric'].get('mountpoint','?')}\")
    if len(seen)>=3: break
" 2>/dev/null
