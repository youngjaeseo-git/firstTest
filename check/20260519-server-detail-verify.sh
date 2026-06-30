#!/bin/bash
# 서버 상세 페이지 - 자동 검증
# UP인 node-exporter를 자동 탐지, hostname 자동 조회
# 실행: bash check/20260519-server-detail-verify.sh [IP]
# IP 생략 시 UP인 첫 번째 서버 자동 선택

PROM=http://10.100.175.248:8080

echo "=== Step 1: UP 서버 탐지 ==="
UP_LIST=$(curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{job="node-exporter"} == 1' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
for item in r:
    inst = item['metric'].get('instance','')
    ip = inst.split(':')[0]
    print(ip)
" 2>/dev/null)

echo "UP servers: $(echo "$UP_LIST" | tr '\n' ' ')"
echo "Total: $(echo "$UP_LIST" | wc -l)"

if [ -n "$1" ]; then
  IP="$1"
else
  IP=$(echo "$UP_LIST" | head -1)
fi
echo "Selected: ${IP}"

echo ""
echo "=== Step 2: hostname 조회 ==="
HOST=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=node_uname_info{instance=~\"${IP}(.*)\"}" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if r:
    m = r[0]['metric']
    print(m.get('nodename',''))
" 2>/dev/null)
echo "hostname=${HOST}"

NE="instance=~\"${IP}(:.*)?\",job=\"node-exporter\""

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

echo ""
echo "=== Health Card ==="
q "node-exporter UP" "up{${NE}}"
q "Uptime(sec)" "time() - node_boot_time_seconds{${NE}}"
q "MemTotal(B)" "node_memory_MemTotal_bytes{${NE}}"
q "MemAvail(B)" "node_memory_MemAvailable_bytes{${NE}}"

echo "=== CPU ==="
q "CPU Usage(%)" "(1 - avg(rate(node_cpu_seconds_total{mode=\"idle\",${NE}}[5m]))) * 100"
q "Load 1m" "node_load1{${NE}}"
q "Load 5m" "node_load5{${NE}}"
q "Load 15m" "node_load15{${NE}}"
q "Mode user(%)" "avg(rate(node_cpu_seconds_total{mode=\"user\",${NE}}[5m])) * 100"
q "Mode system(%)" "avg(rate(node_cpu_seconds_total{mode=\"system\",${NE}}[5m])) * 100"
q "Mode iowait(%)" "avg(rate(node_cpu_seconds_total{mode=\"iowait\",${NE}}[5m])) * 100"
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
q "Disk Usage(%)" "(1 - sum(node_filesystem_avail_bytes{${NE},mountpoint=\"/\",fstype!~\"tmpfs|devtmpfs|overlay|squashfs\"}) / sum(node_filesystem_size_bytes{${NE},mountpoint=\"/\",fstype!~\"tmpfs|devtmpfs|overlay|squashfs\"})) * 100"
q "Filesystem count" "count(node_filesystem_size_bytes{${NE},fstype!~\"tmpfs|devtmpfs|overlay|squashfs|proc|sysfs|autofs|rootfs\"})"

echo "=== Network ==="
q "RX(B/s)" "sum(rate(node_network_receive_bytes_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
q "TX(B/s)" "sum(rate(node_network_transmit_bytes_total{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"}[5m]))"
q "RX Errors" "sum(rate(node_network_receive_errs_total{${NE},device!~\"lo|veth.*\"}[5m]))"
q "TCP Established" "node_netstat_Tcp_CurrEstab{${NE}}"
q "NIC count" "count(node_network_up{${NE},device!~\"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*\"})"

echo "=== Hardware ==="
q "Temperature(C)" "node_hwmon_temp_celsius{${NE}}"
q "Fan RPM" "node_hwmon_fan_rpm{${NE}}"
if [ -n "$HOST" ]; then
  M="instance=~\"${HOST}(:.*)?\""
  q "Power Package(W)" "rate(Package_Joules_Consumed{${M}}[5m])"
  q "Power DRAM(W)" "rate(DRAM_Joules_Consumed{${M}}[5m])"
else
  echo "  Power: hostname 없어서 PCM 조회 불가"
fi
