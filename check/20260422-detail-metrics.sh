#!/bin/bash
# s131x13ae013의 상세 메트릭 가용성 확인
# 사용법: bash check/20260422-detail-metrics.sh [hostname]
PROM="http://10.100.175.248:8080"
API="$PROM/api/v1/query"
HOST="${1:-s131x13ae013}"

pq() {
  curl -s --get --data-urlencode "query=$1" "$API" 2>/dev/null
}

val() {
  pq "$1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print(f'  count={len(r)} val={r[0].get(\"value\",[None,None])[1]}')
else: print('  (없음)')
" 2>/dev/null
}

M="instance=~\"${HOST}(:.*)?\""

echo "=== ${HOST} 메트릭 상세 ==="

echo "-- CPU --"
echo "cpu_usage(id=/):"
val "sum(rate(container_cpu_usage_seconds_total{${M},id=\"/\"}[5m]))"
echo "cpu_cores:"
val "max(machine_cpu_cores{${M}})"
echo "cpu_cores by socket:"
pq "machine_cpu_cores{${M}}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'  시리즈 수: {len(r)}')
for x in r:
  m=x['metric']
  print(f'  socket={m.get(\"socket\",\"?\")} package={m.get(\"package\",\"?\")} val={x[\"value\"][1]}')
" 2>/dev/null

echo "-- Memory --"
echo "memory_bytes:"
val "max(machine_memory_bytes{${M}})"
echo "working_set(id=/):"
val "container_memory_working_set_bytes{${M},id=\"/\"}"
echo "cache(id=/):"
val "container_memory_cache{${M},id=\"/\"}"

echo "-- Disk --"
echo "fs_usage(id=/):"
val "container_fs_usage_bytes{${M},id=\"/\"}"
echo "fs_limit(id=/):"
val "container_fs_limit_bytes{${M},id=\"/\"}"
echo "fs_reads_bytes:"
val "rate(container_fs_reads_bytes_total{${M},id=\"/\"}[5m])"

echo "-- Network --"
echo "net_rx:"
val "rate(container_network_receive_bytes_total{${M},interface!~\"lo|veth.*\"}[5m])"
echo "net_tx:"
val "rate(container_network_transmit_bytes_total{${M},interface!~\"lo|veth.*\"}[5m])"

echo "-- Power --"
echo "Package_Joules:"
val "rate(Package_Joules_Consumed{${M}}[5m])"

echo "-- Status --"
echo "up:"
pq "up{instance=\"${HOST}\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
for x in r: print(f'  job={x[\"metric\"].get(\"job\")} val={x[\"value\"][1]}')
" 2>/dev/null

echo "-- IP 확인 --"
echo "kube_node_info:"
pq "kube_node_info{node=\"${HOST}\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r:
  m=r[0]['metric']
  print(f'  internal_ip={m.get(\"internal_ip\",\"?\")}')
else: print('  (없음)')
" 2>/dev/null

echo ""
echo "=== 완료 ==="
