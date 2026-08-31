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
echo "=== 3. node_uname_info에서 s121x13ae022, s121x13ae030 존재 확인 ==="
curl -s "$PROM/api/v1/query?query=node_uname_info" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'node_uname_info total: {len(r)} series')
targets=['s121x13ae022','s121x13ae030']
found={}
for p in r:
    m=p['metric']
    inst=m.get('instance','')
    nn=m.get('nodename','')
    for t in targets:
        if t in nn or t in inst:
            found[t]={'instance':inst,'nodename':nn}
    # 전체 매핑 출력 (최대 30개)
for p in r[:30]:
    m=p['metric']
    print(f\"  instance={m.get('instance','?'):25s} nodename={m.get('nodename','?')}\")
if len(r)>30:
    print(f'  ... ({len(r)-30} more)')
print()
print('Target servers:')
for t in targets:
    if t in found:
        print(f'  {t}: FOUND instance={found[t][\"instance\"]} nodename={found[t][\"nodename\"]}')
    else:
        print(f'  {t}: NOT FOUND')
" 2>/dev/null

echo ""
echo "=== 4. 해당 서버의 hwmon 온도 데이터 존재 확인 ==="
curl -s "$PROM/api/v1/query?query=avg%20by%20(instance)%20(node_hwmon_temp_celsius)" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'node_hwmon_temp_celsius instances: {len(r)}')
for p in r:
    m=p['metric']
    v=p.get('value',['','?'])[1]
    print(f\"  instance={m.get('instance','?'):25s} temp={v}C\")
" 2>/dev/null

echo ""
echo "=== 5. node-temps API 응답 확인 ==="
curl -s http://localhost:3000/api/metrics/node-temps 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'API returned {len(d)} entries')
for k in sorted(d):
    print(f'  {k}: {d[k]}C')
targets=['s121x13ae022','s121x13ae030']
print()
for t in targets:
    print(f'{t}: {\"FOUND \"+str(d[t])+\"C\" if t in d else \"MISSING\"}')
" 2>/dev/null
