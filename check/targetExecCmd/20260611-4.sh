#!/bin/bash
# 2026-06-11-4: Lab-3 node-exporter 존재 여부 + 노드 IP 확인
# 38.100에서 실행
# 실행: bash check/targetExecCmd/20260611-4.sh

LAB3="http://10.144.131.190:30003"

echo "=== 1. Lab-3 Prometheus가 발견한 노드 목록 ==="
# kubernetes-nodes 타겟에서 노드명+IP 추출
timeout 10 curl -s "$LAB3/api/v1/targets" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
ts=d.get('data',{}).get('activeTargets',[])
nodes=[t for t in ts if t.get('labels',{}).get('job')=='kubernetes-nodes']
lab3=[]
lab1=[]
for t in nodes:
  addr=t.get('discoveredLabels',{}).get('__address__','?')
  name=t.get('labels',{}).get('instance','?')
  h=t.get('health','?')
  if '131.' in addr or '131.' in name:
    lab3.append(f'{addr} {name} {h}')
  else:
    lab1.append(addr)
print(f'Lab-3 nodes ({len(lab3)}):')
for n in lab3: print(f'  {n}')
print(f'Lab-1 nodes: {len(lab1)}개 (생략)')
" 2>/dev/null

echo ""
echo "=== 2. Lab-3 노드에 node-exporter(9100) 접근 테스트 ==="
# Lab-3 대역 IP에 9100 포트 확인 (주요 노드만)
for IP in 10.144.131.101 10.144.131.102 10.144.131.103 10.144.131.190; do
  echo -n "$IP:9100 -> "
  CODE=$(timeout 2 curl -s -o /dev/null -w "%{http_code}" "http://$IP:9100/metrics" 2>/dev/null)
  echo "${CODE:-TIMEOUT}"
done

echo ""
echo "=== 3. kubectl: Lab-3 node-exporter DaemonSet 확인 ==="
# kubectl이 Lab-3 클러스터에 접근 가능하면 실행
# 접근 불가면 이 섹션은 에러 출력됨
echo "-- DaemonSet in monitoring ns --"
kubectl get ds -n monitoring 2>/dev/null | grep -i node || echo "kubectl 불가 또는 node-exporter DS 없음"
echo ""
echo "-- Lab-3 노드 목록 --"
kubectl get nodes -o wide 2>/dev/null | awk 'NR==1||/131\./' || echo "kubectl 불가"

echo ""
echo "=== 끝 ==="
