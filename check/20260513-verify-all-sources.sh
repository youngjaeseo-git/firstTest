#!/bin/bash
# 모델별 데이터 정합성 검증 (v2) — BMC + cAdvisor + node-exporter 통합
# 사용법: bash check/20260513-verify-all-sources.sh BMC_IP HOSTNAME HOST_IP
# 예시:   bash check/20260513-verify-all-sources.sh 192.168.10.101 s121x13ae001 10.144.38.101
#
# BMC_IP:   BMC/Redfish 접속 IP (192.168.10.x 대역)
# HOSTNAME: Prometheus cAdvisor에서 사용하는 instance (호스트네임)
# HOST_IP:  서버의 호스트 IP (node-exporter 타겟 IP)
#
# DCIM UI 화면 섹션 순서로 출력 → UI와 1:1 비교 가능

BMC_IP="${1:?Usage: $0 BMC_IP HOSTNAME HOST_IP}"
HOSTNAME="${2:?Usage: $0 BMC_IP HOSTNAME HOST_IP}"
HOST_IP="${3:?Usage: $0 BMC_IP HOSTNAME HOST_IP}"
BMC_USER="admin"
BMC_PASS="admin"
PROM="http://10.100.175.248:8080"
BMC="https://${BMC_IP}"

rc() { curl -sk -u "${BMC_USER}:${BMC_PASS}" --connect-timeout 5 -m 10 "$@" 2>/dev/null; }
pq() {
  local Q="$1"
  local ENCODED=$(python3 -c "import urllib.parse;print(urllib.parse.quote('''$Q'''))")
  curl -s --connect-timeout 5 -m 10 "${PROM}/api/v1/query?query=${ENCODED}" 2>/dev/null
}
pval() {
  python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r: print(r[0]['value'][1])
else: print('NO_DATA')
" 2>/dev/null
}

echo "================================================================"
echo " DCIM 데이터 정합성 검증 v2 (BMC + cAdvisor + node-exporter)"
echo " BMC: ${BMC_IP} / Host: ${HOSTNAME} / IP: ${HOST_IP}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"

# ═══════════════════════════════════════════
# PART A: BMC/Redfish 데이터
# ═══════════════════════════════════════════
echo ""
echo "████ PART A: BMC/Redfish ████"

echo ""
echo "=== A1. System Info ==="
SYS=$(rc "${BMC}/redfish/v1/Systems/1")
if [ -z "$SYS" ]; then
  echo "  ERROR: BMC 응답 없음"
else
  echo "$SYS" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
print('  Manufacturer: ' + str(d.get('Manufacturer','?')))
print('  Model:        ' + str(d.get('Model','?')))
print('  SerialNumber: ' + str(d.get('SerialNumber','?')))
print('  BiosVersion:  ' + str(d.get('BiosVersion','?')))
print('  PowerState:   ' + str(d.get('PowerState','?')))
ps=d.get('ProcessorSummary',{})
print('  CPU Summary:  ' + str(ps.get('Model','?')) + ' x' + str(ps.get('Count','?')) + ' (' + str(ps.get('CoreCount','?')) + ' cores)')
ms=d.get('MemorySummary',{})
print('  Memory Total: ' + str(ms.get('TotalSystemMemoryGiB','?')) + ' GiB')
" 2>/dev/null
fi

echo ""
echo "=== A2. CPU Detail ==="
PROC_COL=$(rc "${BMC}/redfish/v1/Systems/1/Processors")
if [ -n "$PROC_COL" ]; then
  PROC_PATHS=$(echo "$PROC_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
for m in d.get('Members',[]): print(m.get('@odata.id',''))
" 2>/dev/null)

  for PP in $PROC_PATHS; do
    rc "${BMC}${PP}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
if 'error' in d:
  print('  (Error: resource not found)')
else:
  print('  Socket=' + str(d.get('Socket','?')) + '  Model=' + str(d.get('Model') or d.get('Description','?')))
  print('  Cores=' + str(d.get('TotalCores','?')) + '  Threads=' + str(d.get('TotalThreads','?')) + '  MaxMHz=' + str(d.get('MaxSpeedMHz','?')) + '  TDP=' + str(d.get('TDPWatts','?')) + 'W')
  print('  Arch=' + str(d.get('ProcessorArchitecture','?')) + '  InstrSet=' + str(d.get('InstructionSet','?')))
" 2>/dev/null
  done
fi

echo ""
echo "=== A3. Memory Summary ==="
MEM_COL=$(rc "${BMC}/redfish/v1/Systems/1/Memory")
if [ -n "$MEM_COL" ]; then
  ALL_DIMMS=$(echo "$MEM_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
for m in d.get('Members',[]): print(m.get('@odata.id',''))
" 2>/dev/null)

  POP_COUNT=0
  TOTAL_GIB=0
  SAMPLE=""
  for MP in $ALL_DIMMS; do
    MDATA=$(rc "${BMC}${MP}")
    RESULT=$(echo "$MDATA" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
st=d.get('Status',{}).get('State','')
cap=d.get('CapacityMiB',0) or 0
if st != 'Absent' and cap > 0:
  gb=round(cap/1024)
  loc=d.get('DeviceLocator',d.get('Name','?'))
  mfr=(d.get('Manufacturer','') or '').strip()
  mtype=d.get('MemoryDeviceType',d.get('MemoryType','?'))
  spd=d.get('OperatingSpeedMhz','?')
  print('POP:' + str(cap) + ':' + loc + ' ' + str(gb) + 'GB ' + str(mtype) + ' ' + str(mfr) + ' ' + str(spd) + 'MHz')
else:
  print('ABSENT')
" 2>/dev/null)
    if [[ "$RESULT" == POP:* ]]; then
      CAP=$(echo "$RESULT" | cut -d: -f2)
      INFO=$(echo "$RESULT" | cut -d: -f3-)
      POP_COUNT=$((POP_COUNT + 1))
      TOTAL_GIB=$((TOTAL_GIB + CAP / 1024))
      if [ $POP_COUNT -le 2 ]; then
        SAMPLE="${SAMPLE}    ${INFO}\n"
      fi
    fi
  done
  echo "  Populated: ${POP_COUNT} DIMMs / Total: ${TOTAL_GIB} GiB"
  echo "  [Sample]"
  echo -e "$SAMPLE"
fi

echo ""
echo "=== A4. Thermal/Power ==="
THERMAL=$(rc "${BMC}/redfish/v1/Chassis/1/Thermal")
if [ -n "$THERMAL" ]; then
  echo "$THERMAL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
temps=d.get('Temperatures',[])
fans=d.get('Fans',[])
print('  Temp sensors: ' + str(len(temps)) + ' / Fan sensors: ' + str(len(fans)))
for t in temps[:3]:
  r=t.get('ReadingCelsius','?')
  print('    ' + str(t.get('Name','?')) + ': ' + str(r) + ' C')
if len(temps)>3: print('    ... +' + str(len(temps)-3) + ' more')
" 2>/dev/null
fi

POWER=$(rc "${BMC}/redfish/v1/Chassis/1/Power")
if [ -n "$POWER" ]; then
  echo "$POWER" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
pc=d.get('PowerControl',[])
if pc:
  print('  Power: ' + str(pc[0].get('PowerConsumedWatts','?')) + ' W consumed / ' + str(pc[0].get('PowerCapacityWatts','?')) + ' W capacity')
else:
  print('  PowerControl: (none)')
" 2>/dev/null
fi

# ═══════════════════════════════════════════
# PART B: Prometheus (cAdvisor — 기존)
# ═══════════════════════════════════════════
echo ""
echo "████ PART B: Prometheus cAdvisor (instance=${HOSTNAME}) ████"

echo ""
echo "=== B1. Active Jobs ==="
pq "up{instance=~\"${HOSTNAME}.*\"}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r:
  for x in r:
    j=x['metric'].get('job','?')
    v='UP' if x['value'][1]=='1' else 'DOWN'
    print('  ' + j + ': ' + v)
else: print('  (no matching targets)')
" 2>/dev/null

echo ""
echo "=== B2. cAdvisor CPU ==="
VAL=$(pq "sum(rate(container_cpu_usage_seconds_total{instance=\"${HOSTNAME}\",container!=\"\"}[5m]))" | pval)
CORES=$(pq "machine_cpu_cores{instance=\"${HOSTNAME}\"}" | pval)
echo "  CPU usage (5m rate): ${VAL} cores"
echo "  machine_cpu_cores:   ${CORES}"

echo ""
echo "=== B3. cAdvisor Memory ==="
VAL=$(pq "machine_memory_bytes{instance=\"${HOSTNAME}\"}" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  GB=$(python3 -c "print(str(round(float('${VAL}')/1073741824,1)) + ' GiB')")
else
  GB="NO_DATA"
fi
echo "  machine_memory_bytes: ${GB}"

VAL=$(pq "sum(container_memory_working_set_bytes{instance=\"${HOSTNAME}\",container!=\"\"})" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  GB=$(python3 -c "print(str(round(float('${VAL}')/1073741824,1)) + ' GiB')")
else
  GB="NO_DATA"
fi
echo "  memory_working_set:   ${GB}"

echo ""
echo "=== B4. PCM Power ==="
pq "Package_Joules_Consumed{instance=~\"${HOSTNAME}.*\"}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
print('  Series count: ' + str(len(r)))
for x in r[:2]:
  j=x['metric'].get('job','?')
  print('  job=' + j + ' value=' + x['value'][1])
" 2>/dev/null

# ═══════════════════════════════════════════
# PART C: Prometheus (node-exporter — 신규)
# ═══════════════════════════════════════════
echo ""
echo "████ PART C: Prometheus node-exporter (IP=${HOST_IP}) ████"

echo ""
echo "=== C1. node-exporter 타겟 상태 ==="
pq "up{instance=~\"${HOST_IP}(:.*)?\"}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r:
  for x in r:
    j=x['metric'].get('job','?')
    inst=x['metric'].get('instance','?')
    v='UP' if x['value'][1]=='1' else 'DOWN'
    print('  ' + j + ' (' + inst + '): ' + v)
else: print('  (no node-exporter target for this IP)')
" 2>/dev/null

echo ""
echo "=== C2. node-exporter CPU ==="
VAL=$(pq "count(node_cpu_seconds_total{instance=~\"${HOST_IP}(:.*)?\\,mode=\"idle\"})" | pval)
echo "  CPU cores (idle series): ${VAL}"

VAL=$(pq "100 - avg(rate(node_cpu_seconds_total{instance=~\"${HOST_IP}(:.*)?\",mode=\"idle\"}[5m])) * 100" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  FORMATTED=$(python3 -c "print(str(round(float('${VAL}'),1)) + '%')")
else
  FORMATTED="NO_DATA"
fi
echo "  CPU usage (5m):        ${FORMATTED}"

VAL=$(pq "node_load1{instance=~\"${HOST_IP}(:.*)?\"\}" | pval)
echo "  Load avg 1m:           ${VAL}"
VAL=$(pq "node_load5{instance=~\"${HOST_IP}(:.*)?\"\}" | pval)
echo "  Load avg 5m:           ${VAL}"

echo ""
echo "=== C3. node-exporter Memory ==="
VAL=$(pq "node_memory_MemTotal_bytes{instance=~\"${HOST_IP}(:.*)?\"\}" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  GB=$(python3 -c "print(str(round(float('${VAL}')/1073741824,1)) + ' GiB')")
else
  GB="NO_DATA"
fi
echo "  MemTotal:     ${GB}"

VAL=$(pq "node_memory_MemAvailable_bytes{instance=~\"${HOST_IP}(:.*)?\"\}" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  GB=$(python3 -c "print(str(round(float('${VAL}')/1073741824,1)) + ' GiB')")
else
  GB="NO_DATA"
fi
echo "  MemAvailable: ${GB}"

VAL=$(pq "(1 - node_memory_MemAvailable_bytes{instance=~\"${HOST_IP}(:.*)?\"\} / node_memory_MemTotal_bytes{instance=~\"${HOST_IP}(:.*)?\"\}) * 100" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  FORMATTED=$(python3 -c "print(str(round(float('${VAL}'),1)) + '%')")
else
  FORMATTED="NO_DATA"
fi
echo "  Memory usage: ${FORMATTED}"

echo ""
echo "=== C4. node-exporter Disk ==="
pq "node_filesystem_size_bytes{instance=~\"${HOST_IP}(:.*)?\",fstype!~\"tmpfs|devtmpfs|squashfs\"}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
print('  Filesystems: ' + str(len(r)))
for x in r[:3]:
  mp=x['metric'].get('mountpoint','?')
  sz=round(float(x['value'][1])/1073741824,1)
  print('    ' + mp + ': ' + str(sz) + ' GiB total')
if len(r)>3: print('    ... +' + str(len(r)-3) + ' more')
" 2>/dev/null

echo ""
echo "=== C5. node-exporter Network ==="
pq "node_network_receive_bytes_total{instance=~\"${HOST_IP}(:.*)?\",device!~\"lo|veth.*|cni.*|docker.*|br-.*\"}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
print('  Network interfaces: ' + str(len(r)))
for x in r[:5]:
  dev=x['metric'].get('device','?')
  print('    ' + dev)
" 2>/dev/null

echo ""
echo "=== C6. node-exporter Uptime ==="
VAL=$(pq "node_boot_time_seconds{instance=~\"${HOST_IP}(:.*)?\"\}" | pval)
if [ "$VAL" != "NO_DATA" ]; then
  python3 -c "
import time
boot=float('${VAL}')
uptime=time.time()-boot
days=int(uptime/86400)
hours=int((uptime%86400)/3600)
print('  Boot time: ' + time.strftime('%Y-%m-%d %H:%M', time.localtime(boot)))
print('  Uptime:    ' + str(days) + ' days ' + str(hours) + ' hours')
"
else
  echo "  NO_DATA"
fi

# ═══════════════════════════════════════════
# PART D: 데이터 비교 요약
# ═══════════════════════════════════════════
echo ""
echo "████ PART D: 데이터 비교 요약 ████"
echo ""
echo "  [비교 항목]        [BMC/Redfish]    [cAdvisor]       [node-exporter]"
echo "  ────────────────   ──────────────   ──────────────   ──────────────"

# CPU cores
BMC_CORES=$(echo "$SYS" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
ps=d.get('ProcessorSummary',{})
print(str(ps.get('CoreCount','?')))
" 2>/dev/null)
CA_CORES=$(pq "machine_cpu_cores{instance=\"${HOSTNAME}\"}" | pval)
NE_CORES=$(pq "count(node_cpu_seconds_total{instance=~\"${HOST_IP}(:.*)?\",mode=\"idle\"})" | pval)
printf "  %-18s %-16s %-16s %-16s\n" "CPU cores" "${BMC_CORES}" "${CA_CORES}" "${NE_CORES}"

# Memory total
BMC_MEM=$(echo "$SYS" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
ms=d.get('MemorySummary',{})
print(str(ms.get('TotalSystemMemoryGiB','?')) + ' GiB')
" 2>/dev/null)
CA_MEM_RAW=$(pq "machine_memory_bytes{instance=\"${HOSTNAME}\"}" | pval)
if [ "$CA_MEM_RAW" != "NO_DATA" ]; then
  CA_MEM=$(python3 -c "print(str(round(float('${CA_MEM_RAW}')/1073741824,1)) + ' GiB')")
else
  CA_MEM="NO_DATA"
fi
NE_MEM_RAW=$(pq "node_memory_MemTotal_bytes{instance=~\"${HOST_IP}(:.*)?\"\}" | pval)
if [ "$NE_MEM_RAW" != "NO_DATA" ]; then
  NE_MEM=$(python3 -c "print(str(round(float('${NE_MEM_RAW}')/1073741824,1)) + ' GiB')")
else
  NE_MEM="NO_DATA"
fi
printf "  %-18s %-16s %-16s %-16s\n" "Memory total" "${BMC_MEM}" "${CA_MEM}" "${NE_MEM}"

echo ""
echo "================================================================"
echo " 검증 완료 — 위 결과를 DCIM UI와 비교하세요"
echo " DCIM 서버 상세: http://10.144.38.100:3000/servers/EQUIPMENT_ID"
echo "================================================================"
