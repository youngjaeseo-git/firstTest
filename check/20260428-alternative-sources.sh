#!/bin/bash
# 서버 레벨 메트릭 대안 소스 확인
# cAdvisor 외에 호스트 레벨 데이터를 가져올 수 있는 소스 탐색
# 사용법: bash check/20260428-alternative-sources.sh > alt-sources-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== 대안 메트릭 소스 확인 ($INST) ==="
echo ""

check() {
  local label="$1"
  local query="$2"
  local res
  res=$(curl -s --connect-timeout 5 --get --data-urlencode "query=$query" "$PROM/api/v1/query" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  r=d.get('data',{}).get('result',[])
  if r:
    v=r[0].get('value',['',''])[1]
    print(f'O val={v}')
  else:
    print('X')
except: print('ERR')
" 2>/dev/null)
  printf "%-55s %s\n" "$label" "$res"
}

echo "--- 1. kube-state-metrics (노드 리소스) ---"
check "kube_node_status_capacity_cpu" "kube_node_status_capacity{resource=\"cpu\",node=~\"${INST}.*\"}"
check "kube_node_status_capacity_memory" "kube_node_status_capacity{resource=\"memory\",node=~\"${INST}.*\"}"
check "kube_node_status_capacity_disk" "kube_node_status_capacity{resource=\"ephemeral_storage\",node=~\"${INST}.*\"}"
check "kube_node_status_allocatable_cpu" "kube_node_status_allocatable{resource=\"cpu\",node=~\"${INST}.*\"}"
check "kube_node_status_allocatable_memory" "kube_node_status_allocatable{resource=\"memory\",node=~\"${INST}.*\"}"
check "kube_node_info" "kube_node_info{node=~\"${INST}.*\"}"
echo ""

echo "--- 2. kubelet 메트릭 (호스트 레벨) ---"
check "kubelet_volume_stats_capacity" "count(kubelet_volume_stats_capacity_bytes{instance=~\"${INST}(:.*)?\"})"
check "kubelet_volume_stats_used" "count(kubelet_volume_stats_used_bytes{instance=~\"${INST}(:.*)?\"})"
check "kubelet_running_pods" "kubelet_running_pods{instance=~\"${INST}(:.*)?\"}  "
echo ""

echo "--- 3. cAdvisor machine 메트릭 (호스트 하드웨어) ---"
check "machine_memory_bytes" "machine_memory_bytes{instance=~\"${INST}(:.*)?\"}  "
check "machine_cpu_cores" "machine_cpu_cores{instance=~\"${INST}(:.*)?\"}  "
check "machine_nvm_capacity" "machine_nvm_capacity{instance=~\"${INST}(:.*)?\"}  "
check "machine_swap_bytes" "machine_swap_bytes{instance=~\"${INST}(:.*)?\"}  "
echo ""

echo "--- 4. cAdvisor 디스크 (device별) ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=count by(device)(container_fs_usage_bytes{instance=~\"${INST}(:.*)?\",container!=\"\"})" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  dev=r['metric'].get('device','?')
  cnt=r['value'][1]
  print(f'  device={dev} count={cnt}')
" 2>/dev/null
echo ""

echo "--- 5. 전체 job 목록 (up 상태만) ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=count by(job)(up{instance=~\"${INST}(:.*)?\"}==1)" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  print(f'  job={r[\"metric\"][\"job\"]}')
" 2>/dev/null
echo ""

echo "=== 완료 ==="
