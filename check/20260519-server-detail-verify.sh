#!/bin/bash
# s222hax14ae011 서버 상세 페이지 - 모든 차트 검증
# 화면 차트 1:1 대응, 값 또는 NO_DATA 출력
# 실행: bash check/20260519-server-detail-verify.sh

PROM=http://10.100.175.248:8080
IP="10.144.38.61"
HOST="s222hax14ae011"
NE="instance=~\"${IP}(:.*)?\",job=\"node-exporter\""
CM="instance=~\"${HOST}(:.*)?\",container!=\"\""
M="instance=~\"${HOST}(:.*)?\""

q() {
  local label="$1" query="$2"
  val=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=$query" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print(r[0]['value'][1] if r else 'NO_DATA')
" 2>/dev/null)
  printf "  %-28s %s\n" "$label" "$val"
}

echo "=== Health Card ==="
q "Uptime(sec)" "time() - node_boot_time_seconds{${NE}}"
q "MemAvail(B)" "node_memory_MemAvailable_bytes{${NE}}"
q "MemTotal(B)" "node_memory_MemTotal_bytes{${NE}}"
q "node-exporter UP" "up{${NE}}"
q "cAdvisor UP" "up{job=\"kubernetes-cadvisor\",${M}}"

echo "=== CPU ==="
q "CPU Usage(%)" "(1 - avg(rate(node_cpu_seconds_total{mode=\"idle\",${NE}}[5m]))) * 100"
q "Load 1m" "node_load1{${NE}}"
q "Load 5m" "node_load5{${NE}}"
q "Load 15m" "node_load15{${NE}}"
q "Mode user(%)" "avg(rate(node_cpu_seconds_total{mode=\"user\",${NE}}[5m])) * 100"
q "Mode system(%)" "avg(rate(node_cpu_seconds_total{mode=\"system\",${NE}}[5m])) * 100"
q "Mode iowait(%)" "avg(rate(node_cpu_seconds_total{mode=\"iowait\",${NE}}[5m])) * 100"
q "CFS Throttled" "avg(rate(node_cpu_seconds_total{mode=\"iowait\",${NE}}[5m])) * 100"
q "Core count" "count(node_cpu_seconds_total{mode=\"idle\",${NE}})"
q "Core0 usage(%)" "sum(rate(node_cpu_seconds_total{mode!=\"idle\",cpu=\"0\",${NE}}[5m])) * 100"

echo "=== Memory ==="
q "Mem Usage(%)" "(1 - node_memory_MemAvailable_bytes{${NE}} / node_memory_MemTotal_bytes{${NE}}) * 100"
q "Swap Used(B)" "node_memory_SwapTotal_bytes{${NE}} - node_memory_SwapFree_bytes{${NE}}"
q "Mem Used(B)" "node_memory_MemTotal_bytes{${NE}} - node_memory_MemAvailable_bytes{${NE}}"
q "Cache+Buffer(B)" "node_memory_Cached_bytes{${NE}} + node_memory_Buffers_bytes{${NE}}"

echo "=== Disk ==="
q "Read(B/s)" "sum(rate(node_disk_read_bytes_total{${NE}}[5m]))"
q "Write(B/s)" "sum(rate(node_disk_written_bytes_total{${NE}}[5m]))"
q "Read IOPS" "sum(rate(node_disk_reads_completed_total{${NE}}[5m]))"
q "Write IOPS" "sum(rate(node_disk_writes_completed_total{${NE}}[5m]))"
q "Read Latency(ms)" "sum(rate(node_disk_read_time_seconds_total{${NE}}[5m])) / clamp_min(sum(rate(node_disk_reads_completed_total{${NE}}[5m])), 0.001) * 1000"
q "Write Latency(ms)" "sum(rate(node_disk_write_time_seconds_total{${NE}}[5m])) / clamp_min(sum(rate(node_disk_writes_completed_total{${NE}}[5m])), 0.001) * 1000"
q "Disk Usage(%)" "(1 - sum(node_filesystem_avail_bytes{${NE},mountpoint=\"/\",fstype!~\"tmpfs|devtmpfs|overlay|squashfs\"}) / sum(node_filesystem_size_bytes{${NE},mountpoint=\"/\",fstype!~\"tmpfs|devtmpfs|overlay|squashfs\"})) * 100"
q "Filesystem count" "count(node_filesystem_size_bytes{${NE},fstype!~\"tmpfs|devtmpfs|overlay|squashfs|proc|sysfs|autofs|rootfs\"})"

echo "=== Network ==="
q "RX(B/s)" "sum(rate(node_network_receive_bytes_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
q "TX(B/s)" "sum(rate(node_network_transmit_bytes_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
q "RX Errors" "sum(rate(node_network_receive_errs_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
q "TX Errors" "sum(rate(node_network_transmit_errs_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
q "TCP Established" "node_netstat_Tcp_CurrEstab{${NE}}"
q "TCP Retransmit/s" "rate(node_netstat_TcpExt_TCPRetransSegs{${NE}}[5m])"
q "NIC count" "count(node_network_up{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"})"

echo "=== Hardware ==="
q "Temperature(C)" "node_hwmon_temp_celsius{${NE}}"
q "IPMI Inlet(C)" "{job=\"temperature\",${M},type=~\"inlet|ambient\"}"
q "IPMI Exhaust(C)" "{job=\"temperature\",${M},type=~\"exhaust|outlet\"}"
q "IPMI CPU(C)" "{job=\"temperature\",${M},type=~\"cpu|processor\"}"
q "Fan RPM" "node_hwmon_fan_rpm{${NE}}"
q "Power Package(W)" "rate(Package_Joules_Consumed{${M}}[5m])"
q "Power DRAM(W)" "rate(DRAM_Joules_Consumed{${M}}[5m])"
