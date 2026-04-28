#!/bin/bash
# kube_node_info 라벨 확인 (IP, OS, 커널 정보 등)
# 사용법: bash check/20260428-kube-node-info.sh > kube-node-info-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== kube_node_info 라벨 확인 ($INST) ==="
echo ""

echo "--- 1. kube_node_info 라벨 키 목록 ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_info{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r:
  m=r[0].get('metric',{})
  for k in sorted(m.keys()):
    v=m[k]
    if k in ('boot_id','machine_id','system_uuid'): v=v[:8]+'...'
    print(f'  {k} = {v}')
else:
  print('  X empty')
" 2>/dev/null
echo ""

echo "--- 2. kube_node_status_addresses (IP 확인) ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_status_addresses{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  m=r.get('metric',{})
  print(f'  type={m.get(\"type\",\"?\")} address={m.get(\"address\",\"?\")}')
" 2>/dev/null
echo ""

echo "=== 완료 ==="
