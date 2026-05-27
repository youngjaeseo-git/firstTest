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

echo ""
echo "=== 5. hwmon 센서 중 DIMM/메모리 온도 존재 확인 ==="
echo "-- 5a. chip 라벨에 dimm/mem 포함 여부 --"
curl -s "$PROM/api/v1/query?query=node_hwmon_temp_celsius" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
chips=set()
sensors=set()
for p in r:
    m=p['metric']
    c=m.get('chip','')
    s=m.get('sensor','')
    chips.add(c)
    sensors.add(s)
print(f'total series: {len(r)}')
print(f'unique chips: {len(chips)}')
print(f'unique sensors: {len(sensors)}')
for c in sorted(chips)[:20]:
    print(f'  chip: {c}')
for s in sorted(sensors)[:10]:
    print(f'  sensor: {s}')
" 2>/dev/null

echo ""
echo "-- 5b. 온도 라벨(chip+sensor) 1개 서버 샘플 상세 --"
curl -s "$PROM/api/v1/query?query=node_hwmon_temp_celsius%7Binstance%3D~%2210.144.38.113.*%22%7D" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'{len(r)} sensors on sample server')
for p in sorted(r, key=lambda x: x['metric'].get('chip',''))[:30]:
    m=p['metric']
    v=p['value'][1] if 'value' in p else '?'
    print(f\"  chip={m.get('chip','?')[:40]} sensor={m.get('sensor','?')} val={v}C\")
" 2>/dev/null

echo ""
echo "-- 5c. 메모리 관련 이름을 가진 메트릭 검색 --"
curl -s "$PROM/api/v1/label/__name__/values" 2>/dev/null | tr ',' '\n' | grep -i -E 'dimm|mem.*temp|thermal.*mem' | head -10
