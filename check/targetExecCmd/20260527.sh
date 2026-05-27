#!/bin/bash
# 2026-05-27 확인 스크립트
# 실행: bash check/targetExecCmd/20260527.sh

PROM=http://10.100.175.248:8080

echo "=== 1. kube_pod_status_phase 전체 (값=1인 것만) ==="
curl -s "$PROM/api/v1/query?query=kube_pod_status_phase%7Bnamespace!~%22kube-system%7Cmonitoring%7Ccalico-system%7Ccalico-apiserver%7Ctigera-operator%22%7D==1" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} results')
for p in r[:15]:
    m=p['metric']
    print(f\"  ns={m.get('namespace','?')} pod={m.get('pod','?')[:30]} phase={m.get('phase','?')}\")
" 2>/dev/null

echo ""
echo "=== 2. kube_pod_status_phase 존재 확인 (전체, 1개 샘플) ==="
curl -s "$PROM/api/v1/query?query=kube_pod_status_phase" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} series')
if r: print(json.dumps(r[0]['metric'],indent=2))
" 2>/dev/null

echo ""
echo "=== 3. container waiting reason (ImagePullBackOff 등) ==="
curl -s "$PROM/api/v1/query?query=kube_pod_container_status_waiting_reason%7Bnamespace!~%22kube-system%7Cmonitoring%7Ccalico-system%7Ccalico-apiserver%7Ctigera-operator%22%7D==1" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} waiting containers')
for p in r[:10]:
    m=p['metric']
    print(f\"  ns={m.get('namespace','?')} pod={m.get('pod','?')[:30]} reason={m.get('reason','?')}\")
" 2>/dev/null

echo ""
echo "=== 4. pod phase 관련 메트릭 목록 ==="
curl -s "$PROM/api/v1/label/__name__/values" 2>/dev/null | tr ',' '\n' | grep -i -E 'kube_pod_status|kube_pod_container' | head -15
