#!/bin/bash
# cAdvisor 메트릭 개별 확인 — container!="" 사용 (K8s 환경, id="/" 없음)
# 사용법: bash check/20260423-cadvisor-each-metric.sh > cadvisor-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== cAdvisor 메트릭 확인 ($INST) container!='' ==="
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
check "cpu_usage(container!='')" "sum(rate(container_cpu_usage_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m]))"
check "cpu_user(container!='')" "sum(rate(container_cpu_user_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m]))"
check "cpu_system(container!='')" "sum(rate(container_cpu_system_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m]))"
check "cpu_cfs_throttled(container!='')" "sum(rate(container_cpu_cfs_throttled_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m]))"
check "machine_cpu_cores" "max(machine_cpu_cores{instance=~\"${INST}(:.*)?\"})"
echo ""

echo "--- Memory ---"
check "memory_working_set(container!='')" "sum(container_memory_working_set_bytes{instance=~\"${INST}(:.*)?\",container!=\"\"})"
check "machine_memory_bytes" "max(machine_memory_bytes{instance=~\"${INST}(:.*)?\"})"
check "memory_cache(container!='')" "sum(container_memory_cache{instance=~\"${INST}(:.*)?\",container!=\"\"})"
check "memory_swap(container!='')" "sum(container_memory_swap{instance=~\"${INST}(:.*)?\",container!=\"\"})"
echo ""

echo "--- Disk ---"
check "fs_usage(container!='')" "sum(container_fs_usage_bytes{instance=~\"${INST}(:.*)?\",container!=\"\"})"
check "fs_limit(container!='')" "sum(container_fs_limit_bytes{instance=~\"${INST}(:.*)?\",container!=\"\"})"
check "fs_reads_bytes(rate)" "sum(rate(container_fs_reads_bytes_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m]))"
check "fs_writes_bytes(rate)" "sum(rate(container_fs_writes_bytes_total{instance=~\"${INST}(:.*)?\",container!=\"\"}[5m]))"
echo ""

echo "--- Network ---"
check "net_rx(no id filter)" "sum(rate(container_network_receive_bytes_total{instance=~\"${INST}(:.*)?\",interface!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
check "net_tx(no id filter)" "sum(rate(container_network_transmit_bytes_total{instance=~\"${INST}(:.*)?\",interface!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
check "net_tcp_established" "sum(container_network_tcp_usage_total{instance=~\"${INST}(:.*)?\",tcp_state=\"established\"})"
echo ""

echo "--- Power ---"
check "Package_Joules(rate)" "rate(Package_Joules_Consumed{instance=~\"${INST}(:.*)?\"}[5m])"
echo ""

echo "=== O=데이터있음 X=없음 ==="
