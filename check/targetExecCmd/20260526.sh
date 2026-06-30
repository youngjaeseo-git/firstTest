#!/bin/bash
# 2026-05-26 확인 스크립트
# 실행: bash check/targetExecCmd/20260526.sh

PROM=http://10.100.175.248:8080

echo "=== 1. 온도 관련 메트릭 존재 여부 ==="
curl -s "$PROM/api/v1/label/__name__/values" 2>/dev/null | tr ',' '\n' | grep -i -E 'temp|thermal|therm' | head -10

echo ""
echo "=== 2. Package_Joules_Consumed 라벨 구조 (1개 샘플) ==="
curl -s "$PROM/api/v1/query?query=Package_Joules_Consumed" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print(json.dumps(r[0]['metric'],indent=2))
else: print('NO DATA')
" 2>/dev/null

echo ""
echo "=== 3. Package_Joules_Consumed type 라벨 값 목록 ==="
curl -s "$PROM/api/v1/query?query=count by(type)(Package_Joules_Consumed)" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
    print(f\"{r['metric'].get('type','(none)')}: {r['value'][1]} series\")
" 2>/dev/null

echo ""
echo "=== 4. 전력 관련 메트릭 목록 ==="
curl -s "$PROM/api/v1/label/__name__/values" 2>/dev/null | tr ',' '\n' | grep -i -E 'power|watt|joule|energy|rapl' | head -10

echo ""
echo "=== 5. 현재 총전력 (Watts) ==="
curl -s "$PROM/api/v1/query?query=sum(rate(Package_Joules_Consumed[5m]))" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print(f\"{float(r[0]['value'][1]):.1f} W\")
else: print('NO DATA')
" 2>/dev/null

echo ""
echo "=== 6. 전력 기여 서버별 (상위 5개) ==="
curl -s "$PROM/api/v1/query?query=topk(5,sum by(instance)(rate(Package_Joules_Consumed[5m])))" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
    print(f\"{r['metric'].get('instance','?')}: {float(r['value'][1]):.1f} W\")
" 2>/dev/null

echo ""
echo "=== 7. node-exporter 온도 메트릭 ==="
curl -s "$PROM/api/v1/query?query=node_hwmon_temp_celsius" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} series found')
if r: print(json.dumps(r[0]['metric'],indent=2))
" 2>/dev/null

echo ""
echo "=== 8. IPMI/BMC 온도 메트릭 ==="
curl -s "$PROM/api/v1/label/__name__/values" 2>/dev/null | tr ',' '\n' | grep -i -E 'ipmi|bmc|inlet|outlet|ambient' | head -10

echo ""
echo "=== 9. kube_pod_info 존재 여부 + 라벨 구조 (1개 샘플) ==="
curl -s "$PROM/api/v1/query?query=kube_pod_info" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} pods total')
if r: print(json.dumps(r[0]['metric'],indent=2))
" 2>/dev/null

echo ""
echo "=== 10. namespace 목록 + 각 Pod 수 ==="
curl -s "$PROM/api/v1/query?query=count by(namespace)(kube_pod_info)" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in sorted(d.get('data',{}).get('result',[]), key=lambda x: x['metric'].get('namespace','')):
    print(f\"{r['metric'].get('namespace','?')}: {r['value'][1]} pods\")
" 2>/dev/null

echo ""
echo "=== 11. 시스템 외 워크로드 Pod (prometheus/calico/kube-system/monitoring 제외) ==="
curl -s "$PROM/api/v1/query?query=kube_pod_info%7Bnamespace!~%22kube-system%7Cmonitoring%7Ccalico-system%7Ccalico-apiserver%7Ctigera-operator%22%7D" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} workload pods')
for p in r[:10]:
    m=p['metric']
    print(f\"  ns={m.get('namespace','?')} pod={m.get('pod','?')} node={m.get('node','?')}\")
" 2>/dev/null

echo ""
echo "=== 12. kube_pod_created 존재 여부 (1개 샘플) ==="
curl -s "$PROM/api/v1/query?query=kube_pod_created" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} series found')
if r: print(f\"labels: {list(r[0]['metric'].keys())}\")
if r: print(f\"created_ts: {r[0]['value'][1]}\")
" 2>/dev/null

echo ""
echo "=== 13. kube_pod_status_phase 라벨 구조 ==="
curl -s "$PROM/api/v1/query?query=count by(phase)(kube_pod_status_phase==1)" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
    print(f\"{r['metric'].get('phase','?')}: {r['value'][1]} pods\")
" 2>/dev/null
