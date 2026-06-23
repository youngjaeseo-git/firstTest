#!/bin/bash
# Lab-3 Prometheus kube 메트릭 확인
# 실행: bash check/targetExecCmd/20260623-2.sh
# DCIM 서버(38.100)에서 실행

LAB3_PROM="http://10.144.131.190:30003"

echo "=== 1. Lab-3 Prometheus 접근 확인 ==="
HTTP=$(curl -sk -o /dev/null -w "%{http_code}" "$LAB3_PROM/-/ready" 2>/dev/null)
echo "상태: $HTTP"

echo ""
echo "=== 2. kube_pod_info 건수 ==="
CNT=$(curl -sk "$LAB3_PROM/api/v1/query?query=count(kube_pod_info)" 2>/dev/null \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['result'][0]['value'][1] if d.get('data',{}).get('result') else '0')" 2>/dev/null)
echo "Pod 수: $CNT"

echo ""
echo "=== 3. 네임스페이스별 Pod 수 (상위 5개) ==="
curl -sk "$LAB3_PROM/api/v1/query?query=count(kube_pod_info)by(namespace)" 2>/dev/null \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
rs=d.get('data',{}).get('result',[])
rs.sort(key=lambda x:-int(x['value'][1]))
for r in rs[:5]:
  print(f\"  {r['metric']['namespace']}: {r['value'][1]}\")
if not rs: print('  결과 없음')
" 2>/dev/null

echo ""
echo "=== 4. dcim-test 네임스페이스 Pod ==="
curl -sk "$LAB3_PROM/api/v1/query?query=kube_pod_info%7Bnamespace%3D%22dcim-test%22%7D" 2>/dev/null \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
rs=d.get('data',{}).get('result',[])
print(f'dcim-test Pod: {len(rs)}개')
for r in rs[:5]:
  m=r['metric']
  print(f\"  {m.get('pod','?')} node={m.get('node','?')}\")
" 2>/dev/null

echo ""
echo "=== 5. kube_node_info (Lab-3 노드 목록) ==="
curl -sk "$LAB3_PROM/api/v1/query?query=kube_node_info" 2>/dev/null \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
rs=d.get('data',{}).get('result',[])
print(f'노드 수: {len(rs)}')
for r in rs[:5]:
  m=r['metric']
  print(f\"  {m.get('node','?')} ip={m.get('internal_ip','?')}\")
if len(rs)>5: print(f'  ...외 {len(rs)-5}개')
" 2>/dev/null

echo ""
echo "=== 6. Lab-1 Prometheus에서 Lab-3 kube 메트릭 확인 ==="
LAB1_PROM="http://10.144.38.100:30003"
CNT2=$(curl -sk "$LAB1_PROM/api/v1/query?query=count(kube_pod_info%7Bnode%3D~%22.*131.*%22%7D)" 2>/dev/null \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['result'][0]['value'][1] if d.get('data',{}).get('result') else '0')" 2>/dev/null)
echo "Lab-1에서 보이는 Lab-3 Pod: $CNT2"
