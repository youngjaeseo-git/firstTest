#!/bin/bash
# 서버 IP 주소를 가져올 수 있는 모든 소스 확인
# 사용법: bash check/20260428-find-ip-source.sh > find-ip-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== IP 주소 소스 탐색 ($INST) ==="
echo ""

echo "--- 1. kube_node_status_addresses ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_status_addresses{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('  X empty')
for x in r:
  m=x.get('metric',{})
  print(f'  type={m.get(\"type\",\"?\")} address={m.get(\"address\",\"?\")}')
" 2>/dev/null
echo ""

echo "--- 2. kube_node_info 라벨 중 ip 관련 ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_info{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('  X empty')
for x in r:
  m=x.get('metric',{})
  for k in sorted(m.keys()):
    if 'ip' in k.lower() or 'addr' in k.lower() or 'host' in k.lower() or k=='instance' or k=='node':
      print(f'  {k} = {m[k]}')
" 2>/dev/null
echo ""

echo "--- 3. up 메트릭의 instance 라벨 (IP:port 형식인 job) ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=up{instance=~\"${INST}(.*)?\"}  " "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('  X empty')
for x in r:
  m=x.get('metric',{})
  print(f'  job={m.get(\"job\",\"?\")} instance={m.get(\"instance\",\"?\")}')
" 2>/dev/null
echo ""

echo "--- 4. kubelet instance (IP:10250 형태일 수 있음) ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kubelet_running_pods{instance=~\"${INST}(.*)?\"}  " "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('  X empty')
for x in r:
  m=x.get('metric',{})
  print(f'  instance={m.get(\"instance\",\"?\")}')
" 2>/dev/null
echo ""

echo "--- 5. kubernetes-nodes job의 instance ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=up{job=\"kubernetes-nodes\",instance=~\"${INST}(.*)?\"}  " "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('  X empty')
for x in r:
  m=x.get('metric',{})
  print(f'  instance={m.get(\"instance\",\"?\")} __address__={m.get(\"__address__\",\"N/A\")}')
" 2>/dev/null
echo ""

echo "=== 완료 ==="
