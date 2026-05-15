#!/bin/bash
# node-exporter collector 상태 확인 — 어떤 메트릭이 수집되는지 조사
# 실행: bash check/20260515-node-exporter-collectors.sh
# 대상: SPR (10.144.38.103:9100)

PROM=http://10.100.175.248:8080
NE_INST="10.144.38.103:9100"

echo "=== 1. node-exporter 메트릭 이름 목록 (node_ prefix) ==="
curl -s "$PROM/api/v1/label/__name__/values" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
names = [n for n in d.get('data', []) if n.startswith('node_')]
print('Total node_ metrics: ' + str(len(names)))
for n in sorted(names)[:50]:
    print('  ' + n)
if len(names) > 50:
    print('  ... +' + str(len(names)-50) + ' more')
"

echo ""
echo "=== 2. 핵심 메트릭 존재 여부 ==="
for METRIC in node_cpu_seconds_total node_load1 node_load5 node_load15 \
  node_memory_MemTotal_bytes node_memory_MemAvailable_bytes \
  node_memory_Cached_bytes node_memory_Buffers_bytes \
  node_memory_SwapTotal_bytes node_memory_SwapFree_bytes \
  node_boot_time_seconds node_hwmon_temp_celsius node_hwmon_fan_rpm \
  node_filesystem_size_bytes node_network_up node_disk_read_bytes_total \
  node_netstat_Tcp_CurrEstab node_netstat_TcpExt_TCPRetransSegs \
  node_procs_running node_filefd_allocated; do
  COUNT=$(curl -s "$PROM/api/v1/query?query=count($METRIC{instance=\"$NE_INST\"})" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print(r[0]['value'][1] if r else '0')
" 2>/dev/null)
  if [ "$COUNT" = "0" ]; then
    echo "  MISSING: $METRIC"
  else
    echo "  OK ($COUNT series): $METRIC"
  fi
done

echo ""
echo "=== 3. node-exporter 타겟 상세 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for t in d.get('data',{}).get('activeTargets',[]):
    if t.get('labels',{}).get('job') == 'node-exporter':
        inst = t.get('labels',{}).get('instance','')
        health = t.get('health','')
        err = t.get('lastError','')
        dur = t.get('lastScrapeDuration',0)
        print('  ' + inst + ' health=' + health + ' scrape=' + str(round(dur,3)) + 's')
        if err:
            print('    error: ' + err[:200])
"

echo ""
echo "=== 4. SPR에서 직접 node-exporter /metrics 샘플 ==="
echo "  (curl로 node-exporter에서 직접 가져온 메트릭 중 핵심 확인)"
for PATTERN in "node_load1 " "node_memory_MemTotal" "node_boot_time" "node_cpu_seconds_total.*idle"; do
  FOUND=$(curl -s --connect-timeout 3 -m 5 "http://10.144.38.103:9100/metrics" 2>/dev/null | grep -c "$PATTERN")
  echo "  $PATTERN: $FOUND lines"
done

echo ""
echo "=== 5. GNR-AP/GNR-SP node-exporter 동일 확인 ==="
for IP in 10.144.38.61 10.144.38.81; do
  NE="$IP:9100"
  MEM=$(curl -s "$PROM/api/v1/query?query=node_memory_MemTotal_bytes{instance=\"$NE\"}" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print(r[0]['value'][1] if r else 'NO_DATA')
" 2>/dev/null)
  LOAD=$(curl -s "$PROM/api/v1/query?query=node_load1{instance=\"$NE\"}" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print(r[0]['value'][1] if r else 'NO_DATA')
" 2>/dev/null)
  echo "  $NE: mem=$MEM load=$LOAD"
done
