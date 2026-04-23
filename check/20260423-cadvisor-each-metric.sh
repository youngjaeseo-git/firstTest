#!/bin/bash
# cAdvisor 메트릭을 하나씩 확인 (s131x13ae013 기준)
# 한 번에 전체가 아니라 카테고리별로 존재 여부만 확인
#
# 사용법: bash check/20260423-cadvisor-each-metric.sh > cadvisor-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s131x13ae013"

echo "=== cAdvisor 메트릭 개별 확인 ($INST) ==="
echo ""

check() {
  local label="$1"
  local query="$2"
  local count
  count=$(curl -s --connect-timeout 5 --get --data-urlencode "query=$query" "$PROM/api/v1/query" | python3 -c "
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
  printf "%-45s %s\n" "$label" "$count"
}

echo "--- CPU ---"
check "cpu_usage(rate5m)" "sum(rate(container_cpu_usage_seconds_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "cpu_user(rate5m)" "sum(rate(container_cpu_user_seconds_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "cpu_system(rate5m)" "sum(rate(container_cpu_system_seconds_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "cpu_cfs_throttled(rate5m)" "sum(rate(container_cpu_cfs_throttled_seconds_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "machine_cpu_cores" "max(machine_cpu_cores{instance=~\"${INST}(:.*)?\"})"
echo ""

echo "--- Memory ---"
check "memory_working_set" "sum(container_memory_working_set_bytes{instance=~\"${INST}(:.*)?\",id=\"/\"})"
check "machine_memory_bytes" "max(machine_memory_bytes{instance=~\"${INST}(:.*)?\"})"
check "memory_cache" "sum(container_memory_cache{instance=~\"${INST}(:.*)?\",id=\"/\"})"
check "memory_swap" "container_memory_swap{instance=~\"${INST}(:.*)?\",id=\"/\"}"
echo ""

echo "--- Disk ---"
check "fs_usage_bytes" "sum(container_fs_usage_bytes{instance=~\"${INST}(:.*)?\",id=\"/\"})"
check "fs_limit_bytes" "sum(container_fs_limit_bytes{instance=~\"${INST}(:.*)?\",id=\"/\"})"
check "fs_reads_bytes(rate)" "sum(rate(container_fs_reads_bytes_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "fs_writes_bytes(rate)" "sum(rate(container_fs_writes_bytes_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "fs_reads_total(rate)" "sum(rate(container_fs_reads_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "fs_writes_total(rate)" "sum(rate(container_fs_writes_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "fs_read_seconds(rate)" "sum(rate(container_fs_read_seconds_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
check "fs_write_seconds(rate)" "sum(rate(container_fs_write_seconds_total{instance=~\"${INST}(:.*)?\",id=\"/\"}[5m]))"
echo ""

echo "--- Network ---"
check "net_rx_bytes(rate)" "sum(rate(container_network_receive_bytes_total{instance=~\"${INST}(:.*)?\",interface!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
check "net_tx_bytes(rate)" "sum(rate(container_network_transmit_bytes_total{instance=~\"${INST}(:.*)?\",interface!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
check "net_rx_errors(rate)" "sum(rate(container_network_receive_errors_total{instance=~\"${INST}(:.*)?\",interface!~\"lo|veth.*\"}[5m]))"
check "net_tx_errors(rate)" "sum(rate(container_network_transmit_errors_total{instance=~\"${INST}(:.*)?\",interface!~\"lo|veth.*\"}[5m]))"
check "net_tcp_established" "sum(container_network_tcp_usage_total{instance=~\"${INST}(:.*)?\",tcp_state=\"established\"})"
echo ""

echo "--- Power (PCM) ---"
check "Package_Joules(rate)" "rate(Package_Joules_Consumed{instance=~\"${INST}(:.*)?\"}[5m])"
echo ""

echo "=== 요약: O=데이터있음 X=없음 ERR=쿼리실패 ==="
