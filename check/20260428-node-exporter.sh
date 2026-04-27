#!/bin/bash
# node_exporter 메트릭 존재 여부 확인
# 사용법: bash check/20260428-node-exporter.sh > node-exporter-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== node_exporter 확인 ($INST) ==="
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
    print('X empty')
except: print('ERR')
" 2>/dev/null)
  printf "%-50s %s\n" "$label" "$res"
}

echo "--- 1. node_exporter job 존재 확인 ---"
check "up{job=node-exporter}" "up{job=\"node-exporter\"}"
check "up{job=node_exporter}" "up{job=\"node_exporter\"}"
echo ""

echo "--- 2. node_exporter 관련 job 검색 ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=count by(job)(up)" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  job=r.get('metric',{}).get('job','')
  cnt=r.get('value',['',''])[1]
  if 'node' in job.lower() or 'export' in job.lower():
    print(f'  job={job} count={cnt}')
" 2>/dev/null
echo ""

echo "--- 3. node_exporter 대표 메트릭 ($INST) ---"
check "node_cpu_seconds_total" "count(node_cpu_seconds_total{instance=~\"${INST}(:.*)?\"})"
check "node_memory_MemTotal" "node_memory_MemTotal_bytes{instance=~\"${INST}(:.*)?\"}  "
check "node_filesystem_size" "count(node_filesystem_size_bytes{instance=~\"${INST}(:.*)?\"})"
check "node_network_receive" "count(node_network_receive_bytes_total{instance=~\"${INST}(:.*)?\"})"
check "node_load1" "node_load1{instance=~\"${INST}(:.*)?\"}  "
check "node_disk_read_bytes" "count(node_disk_read_bytes_total{instance=~\"${INST}(:.*)?\"})"
echo ""

echo "--- 4. 전체에서 node_ 메트릭 존재 확인 ---"
check "node_cpu(any instance)" "count(node_cpu_seconds_total)"
check "node_memory(any instance)" "count(node_memory_MemTotal_bytes)"
echo ""

echo "=== 완료 ==="
