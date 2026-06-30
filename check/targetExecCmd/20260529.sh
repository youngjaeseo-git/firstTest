#!/bin/bash
# 2026-05-29: hostname ↔ IP 매핑 + DaemonSet/IPMI 구조 확인
PROM="http://10.144.38.100:30003"

echo "=== 0. monitoring 네임스페이스 DaemonSet 목록 ==="
kubectl get daemonset -n monitoring -o wide 2>/dev/null || echo "kubectl 실패"

echo ""
echo "=== 0-1. IPMI 관련 Pod/DaemonSet 확인 ==="
kubectl get pods -A 2>/dev/null | grep -i ipmi | head -5
echo "---"
kubectl get daemonset -A 2>/dev/null | grep -i ipmi | head -5

echo ""
echo "=== 0-2. node-exporter DaemonSet 상태 ==="
kubectl get pods -n monitoring -l app=node-exporter --no-headers 2>/dev/null | awk '{print $3}' | sort | uniq -c | sort -rn

echo ""
echo "=== 0-3. Prometheus ConfigMap job 목록 (job_name만) ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data.prometheus\.yml}' 2>/dev/null | grep "job_name" | head -20

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
