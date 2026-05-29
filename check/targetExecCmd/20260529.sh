#!/bin/bash
# 2026-05-29: hostname ↔ IP 전체 매핑 추출
# node_uname_info에서 nodename(호스트네임)과 instance(IP:port)를 매핑
PROM="http://10.144.38.100:30003"

echo "=== 1. node_uname_info hostname-IP 매핑 ==="
curl -s "$PROM/api/v1/query?query=node_uname_info" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
pairs = []
for r in results:
    m = r['metric']
    inst = m.get('instance','')
    hostname = m.get('nodename','')
    ip = inst.replace(':9100','').replace(':10250','')
    if hostname and ip:
        pairs.append((ip, hostname))
pairs.sort()
for ip, h in pairs:
    print(f'{ip}  {h}')
print(f'--- total: {len(pairs)}')
" 2>/dev/null || echo "python3 파싱 실패 - raw 출력:"

echo ""
echo "=== 2. server-info job hostname 목록 ==="
curl -s "$PROM/api/v1/query?query=up{job=\"server-info\"}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
for r in sorted(results, key=lambda x: x['metric'].get('instance','')):
    m = r['metric']
    print(f\"{m.get('instance',''):30s}  up={r['value'][1]}\")
print(f'--- total: {len(results)}')
" 2>/dev/null

echo ""
echo "=== 3. node-exporter 현재 타겟 ==="
curl -s "$PROM/api/v1/query?query=up{job=\"node-exporter\"}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
for r in sorted(results, key=lambda x: x['metric'].get('instance','')):
    m = r['metric']
    print(f\"{m.get('instance',''):25s}  up={r['value'][1]}\")
print(f'--- total: {len(results)}')
" 2>/dev/null
