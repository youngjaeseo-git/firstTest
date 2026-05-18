#!/bin/bash
# 서버 상세 페이지 메트릭 검증: s222hax14ae011 (IP: 10.144.38.61)
# 실행: bash check/20260519-server-detail-verify.sh
# 화면의 각 차트/카드 값과 비교

PROM=http://10.100.175.248:8080
INST="s222hax14ae011"
IP="10.144.38.61"

# node-exporter matcher
NE="instance=~\"${IP}(:.*)?\",job=\"node-exporter\""
# cAdvisor matcher
CA="instance=~\"${IP}(:.*)?\",container!=\"\""

q() {
  curl -s "$PROM/api/v1/query" --data-urlencode "query=$1" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  NO_DATA')
else:
    for item in r[:3]:
        lbl = ' '.join(f'{k}={v}' for k,v in item['metric'].items() if k not in ('__name__','job','instance'))
        val = item['value'][1]
        print(f'  {val}' + (f'  ({lbl})' if lbl else ''))
" 2>/dev/null
}

echo "=== System Health 카드 ==="
echo "Uptime (seconds):"
q "time() - node_boot_time_seconds{${NE}}"
echo "Memory Available:"
q "node_memory_MemAvailable_bytes{${NE}}"
echo "Memory Total:"
q "node_memory_MemTotal_bytes{${NE}}"
echo "node-exporter UP:"
q "up{${NE}}"
echo "cAdvisor UP:"
q "up{job=\"kubernetes-cadvisor\",instance=~\"${INST}(.*)\"}"

echo ""
echo "=== CPU 섹션 ==="
echo "CPU Usage (%):"
q "(1 - avg(rate(node_cpu_seconds_total{mode=\"idle\",${NE}}[5m]))) * 100"
echo "Load Avg 1m/5m/15m:"
q "node_load1{${NE}}"
q "node_load5{${NE}}"
q "node_load15{${NE}}"
echo "CPU cores (per-core count):"
q "count(node_cpu_seconds_total{mode=\"idle\",${NE}})"

echo ""
echo "=== Memory 섹션 ==="
echo "Memory Usage (%):"
q "(1 - node_memory_MemAvailable_bytes{${NE}} / node_memory_MemTotal_bytes{${NE}}) * 100"
echo "Memory Used (bytes):"
q "node_memory_MemTotal_bytes{${NE}} - node_memory_MemAvailable_bytes{${NE}}"
echo "Cache+Buffer (bytes):"
q "node_memory_Cached_bytes{${NE}} + node_memory_Buffers_bytes{${NE}}"

echo ""
echo "=== Disk 섹션 ==="
echo "Disk Read (bytes/s):"
q "sum(rate(node_disk_read_bytes_total{${NE}}[5m]))"
echo "Disk Write (bytes/s):"
q "sum(rate(node_disk_written_bytes_total{${NE}}[5m]))"
echo "Disk Usage (%):"
q "(1 - sum(node_filesystem_avail_bytes{${NE},mountpoint=\"/\",fstype!~\"tmpfs|devtmpfs|overlay|squashfs\"}) / sum(node_filesystem_size_bytes{${NE},mountpoint=\"/\",fstype!~\"tmpfs|devtmpfs|overlay|squashfs\"})) * 100"

echo ""
echo "=== Network 섹션 ==="
echo "RX (bytes/s):"
q "sum(rate(node_network_receive_bytes_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
echo "TX (bytes/s):"
q "sum(rate(node_network_transmit_bytes_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
echo "TCP Established:"
q "node_netstat_Tcp_CurrEstab{${NE}}"

echo ""
echo "=== Hardware 섹션 ==="
echo "Temperature:"
q "node_hwmon_temp_celsius{${NE}}"
echo "Fan RPM:"
q "node_hwmon_fan_rpm{${NE}}"
echo "Power (Package W):"
q "rate(Package_Joules_Consumed{instance=~\"${INST}(.*)\"}[5m])"
echo "Power (DRAM W):"
q "rate(DRAM_Joules_Consumed{instance=~\"${INST}(.*)\"}[5m])"
