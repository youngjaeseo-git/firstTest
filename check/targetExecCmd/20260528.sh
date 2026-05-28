#!/bin/bash
# 2026-05-28 확인 스크립트
# 실행: bash check/targetExecCmd/20260528.sh

echo "=== 1. 워크로드 Pod가 실행 중인 노드 목록 ==="
PROM=http://10.100.175.248:8080
curl -s "$PROM/api/v1/query?query=kube_pod_info%7Bnamespace!~%22kube-system%7Cmonitoring%7Ccalico-system%7Ccalico-apiserver%7Ctigera-operator%22%7D" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
nodes=set()
ns_nodes={}
for p in r:
    m=p['metric']
    ns=m.get('namespace','?')
    node=m.get('node','?')
    nodes.add(node)
    ns_nodes.setdefault(ns,[])
    if node not in ns_nodes[ns]:
        ns_nodes[ns].append(node)
print(f'Total unique nodes: {len(nodes)}')
for ns in sorted(ns_nodes):
    print(f'  {ns}: {ns_nodes[ns]}')
" 2>/dev/null

echo ""
echo "=== 2. DB Equipment 테이블의 hostname-IP 매핑 ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -t -A -c "SELECT hostname, \"ipAddress\" FROM \"Equipment\" WHERE hostname IS NOT NULL ORDER BY hostname" 2>/dev/null | head -30

echo ""
echo "=== 3. 워크로드 노드 vs DB 매핑 비교 ==="
echo "위 1번의 노드 목록과 2번의 hostname을 비교하여 누락된 것을 확인하세요"
