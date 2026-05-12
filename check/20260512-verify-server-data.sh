#!/bin/bash
# 서버 데이터 정합성 검증 — BMC(Redfish) + Prometheus 통합 조회
# 사용법: bash check/20260512-verify-server-data.sh BMC_IP HOSTNAME
# 예시:   bash check/20260512-verify-server-data.sh 192.168.10.101 s121x13ae001
#
# DCIM UI 화면과 1:1 비교하기 위해 UI 섹션 순서로 출력
# Prometheus: ClusterIP http://10.100.175.248:8080 (클러스터 내부)

BMC_IP="${1:?Usage: $0 BMC_IP HOSTNAME}"
HOSTNAME="${2:?Usage: $0 BMC_IP HOSTNAME}"
BMC_USER="admin"
BMC_PASS="admin"
PROM="http://10.100.175.248:8080"
BMC="https://${BMC_IP}"

rc() { curl -sk -u "${BMC_USER}:${BMC_PASS}" --connect-timeout 5 -m 10 "$@" 2>/dev/null; }
pq() { curl -s --connect-timeout 5 -m 10 "${PROM}/api/v1/query?query=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$1'))")" 2>/dev/null; }

echo "========================================"
echo " DCIM 데이터 정합성 검증"
echo " BMC: ${BMC_IP}  /  Host: ${HOSTNAME}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ─── 1. System Info (BMC Redfish) ───
echo ""
echo "=== 1. SYSTEM INFO (Redfish /Systems/1) ==="
SYS=$(rc "${BMC}/redfish/v1/Systems/1")
if [ -z "$SYS" ]; then
  echo "  ERROR: BMC 응답 없음"
else
  echo "$SYS" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
print(f\"  Manufacturer:  {d.get('Manufacturer','?')}\")
print(f\"  Model:         {d.get('Model','?')}\")
print(f\"  SerialNumber:  {d.get('SerialNumber','?')}\")
print(f\"  BiosVersion:   {d.get('BiosVersion','?')}\")
print(f\"  UUID:          {d.get('UUID','?')}\")
print(f\"  PowerState:    {d.get('PowerState','?')}\")
print(f\"  HostName:      {d.get('HostName','?')}\")
ps=d.get('ProcessorSummary',{})
print(f\"  CPU Summary:   {ps.get('Model','?')} x{ps.get('Count','?')} ({ps.get('CoreCount','?')} cores)\")
ms=d.get('MemorySummary',{})
print(f\"  Memory Total:  {ms.get('TotalSystemMemoryGiB','?')} GiB\")
" 2>/dev/null
fi

# ─── 2. CPU Detail (Redfish /Processors) ───
echo ""
echo "=== 2. CPU DETAIL (Redfish /Processors) ==="
PROC_COL=$(rc "${BMC}/redfish/v1/Systems/1/Processors")
if [ -n "$PROC_COL" ]; then
  echo "$PROC_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
members=d.get('Members',[])
print(f'  Processor count: {len(members)}')
for m in members:
  print(f\"  Path: {m.get('@odata.id','?')}\")
" 2>/dev/null

  PROC_PATHS=$(echo "$PROC_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
for m in d.get('Members',[]): print(m.get('@odata.id',''))
" 2>/dev/null)

  for PP in $PROC_PATHS; do
    echo ""
    echo "  --- ${PP} ---"
    rc "${BMC}${PP}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
if 'error' in d:
  print('  (Error: resource not found)')
else:
  print(f\"  Id:           {d.get('Id','?')}\")
  print(f\"  Socket:       {d.get('Socket','?')}\")
  print(f\"  Model:        {d.get('Model','?')}\")
  print(f\"  Description:  {d.get('Description','?')}\")
  print(f\"  Manufacturer: {d.get('Manufacturer','?')}\")
  print(f\"  TotalCores:   {d.get('TotalCores','?')}\")
  print(f\"  TotalThreads: {d.get('TotalThreads','?')}\")
  print(f\"  MaxSpeedMHz:  {d.get('MaxSpeedMHz','?')}\")
  print(f\"  TDPWatts:     {d.get('TDPWatts','?')}\")
  print(f\"  Architecture: {d.get('ProcessorArchitecture','?')}\")
  print(f\"  InstrSet:     {d.get('InstructionSet','?')}\")
  pid=d.get('ProcessorId',{})
  if pid:
    print(f\"  ProcessorId.EffectiveFamily: {pid.get('EffectiveFamily','?')}\")
    print(f\"  ProcessorId.VendorId:        {pid.get('VendorId','?')}\")
  st=d.get('Status',{})
  print(f\"  Status:       {st.get('State','?')} / {st.get('Health','?')}\")
" 2>/dev/null
  done
fi

# ─── 3. Memory (Redfish /Memory) ───
echo ""
echo "=== 3. MEMORY (Redfish /Memory) ==="
MEM_COL=$(rc "${BMC}/redfish/v1/Systems/1/Memory")
if [ -n "$MEM_COL" ]; then
  echo "$MEM_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
members=d.get('Members',[])
print(f'  DIMM slot count: {len(members)}')
" 2>/dev/null

  FIRST_3=$(echo "$MEM_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
members=d.get('Members',[])
populated=[]
for m in members:
  populated.append(m.get('@odata.id',''))
for p in populated[:3]: print(p)
" 2>/dev/null)

  POP_COUNT=0
  TOTAL_GIB=0
  ALL_DIMMS=$(echo "$MEM_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
for m in d.get('Members',[]): print(m.get('@odata.id',''))
" 2>/dev/null)

  for MP in $ALL_DIMMS; do
    MDATA=$(rc "${BMC}${MP}")
    RESULT=$(echo "$MDATA" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
st=d.get('Status',{}).get('State','')
cap=d.get('CapacityMiB',0) or 0
if st != 'Absent' and cap > 0:
  print(f'POP:{cap}')
else:
  print('ABSENT')
" 2>/dev/null)
    if [[ "$RESULT" == POP:* ]]; then
      CAP="${RESULT#POP:}"
      POP_COUNT=$((POP_COUNT + 1))
      TOTAL_GIB=$((TOTAL_GIB + CAP / 1024))
    fi
  done
  echo "  Populated DIMMs: ${POP_COUNT}"
  echo "  Total capacity:  ${TOTAL_GIB} GiB"

  echo ""
  echo "  [Sample: first 3 slots]"
  for MP in $FIRST_3; do
    rc "${BMC}${MP}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
st=d.get('Status',{}).get('State','?')
cap=d.get('CapacityMiB',0) or 0
if st == 'Absent' or cap == 0:
  print(f\"  {d.get('DeviceLocator',d.get('Name','?'))}: (empty)\")
else:
  gb=round(cap/1024)
  print(f\"  {d.get('DeviceLocator',d.get('Name','?'))}: {gb}GB {d.get('MemoryDeviceType',d.get('MemoryType','?'))} {(d.get('Manufacturer','') or '').strip()} {d.get('OperatingSpeedMhz','?')}MHz\")
" 2>/dev/null
  done
fi

# ─── 4. Network (Redfish /EthernetInterfaces) ───
echo ""
echo "=== 4. NETWORK (Redfish /EthernetInterfaces) ==="
NIC_COL=$(rc "${BMC}/redfish/v1/Systems/1/EthernetInterfaces")
if [ -n "$NIC_COL" ]; then
  NIC_PATHS=$(echo "$NIC_COL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
members=d.get('Members',[])
print(f'  NIC count: {len(members)}')
for m in members: print(m.get('@odata.id',''))
" 2>/dev/null)

  NIC_COUNT=$(echo "$NIC_PATHS" | head -1)
  echo "$NIC_COUNT"

  echo "$NIC_PATHS" | tail -n +2 | while read NP; do
    [ -z "$NP" ] && continue
    rc "${BMC}${NP}" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
mac=d.get('MACAddress','?')
spd=d.get('SpeedMbps','?')
link=d.get('LinkStatus','?')
ipv4=d.get('IPv4Addresses',[])
ip=ipv4[0].get('Address','?') if ipv4 else '?'
print(f\"  {d.get('Id','?')}: MAC={mac} Speed={spd}Mbps Link={link} IP={ip}\")
" 2>/dev/null
  done
fi

# ─── 5. Sensors: Thermal (Redfish /Chassis/1/Thermal) ───
echo ""
echo "=== 5. SENSORS - THERMAL (Redfish /Chassis/1/Thermal) ==="
THERMAL=$(rc "${BMC}/redfish/v1/Chassis/1/Thermal")
if [ -n "$THERMAL" ]; then
  echo "$THERMAL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
temps=d.get('Temperatures',[])
fans=d.get('Fans',[])
print(f'  Temperature sensors: {len(temps)}')
print(f'  Fan sensors:         {len(fans)}')
print()
print('  [Temperatures - top 5]')
for t in temps[:5]:
  r=t.get('ReadingCelsius','?')
  c=t.get('UpperThresholdCritical','')
  cs=f' (crit:{c})' if c else ''
  print(f\"    {t.get('Name','?')}: {r} C{cs}\")
if len(temps)>5: print(f'    ... +{len(temps)-5} more')
print()
print('  [Fans]')
for f in fans:
  r=f.get('Reading','?')
  u=f.get('ReadingUnits','RPM')
  print(f\"    {f.get('Name','?')}: {r} {u}\")
" 2>/dev/null
fi

# ─── 6. Sensors: Power (Redfish /Chassis/1/Power) ───
echo ""
echo "=== 6. SENSORS - POWER (Redfish /Chassis/1/Power) ==="
POWER=$(rc "${BMC}/redfish/v1/Chassis/1/Power")
if [ -n "$POWER" ]; then
  echo "$POWER" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
pc=d.get('PowerControl',[])
ps=d.get('PowerSupplies',[])
if pc:
  p=pc[0]
  print(f\"  ConsumedWatts:  {p.get('PowerConsumedWatts','?')} W\")
  print(f\"  CapacityWatts:  {p.get('PowerCapacityWatts','?')} W\")
  lim=p.get('PowerLimit',{})
  print(f\"  LimitWatts:     {lim.get('LimitInWatts','?')} W\")
else:
  print('  PowerControl: (none)')
print(f'  PSU count: {len(ps)}')
for s in ps:
  st=s.get('Status',{}).get('Health','?')
  print(f\"    {s.get('Name','?')}: {s.get('Model','?')} {s.get('PowerCapacityWatts','?')}W type={s.get('PowerSupplyType','?')} status={st}\")
" 2>/dev/null
fi

# ─── 7. Prometheus Metrics ───
echo ""
echo "=== 7. PROMETHEUS METRICS (instance=${HOSTNAME}) ==="

# CPU usage
CPU_RESULT=$(pq "sum(rate(container_cpu_usage_seconds_total{instance=\"${HOSTNAME}\",container!=\"\"}[5m]))")
CPU_VAL=$(echo "$CPU_RESULT" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r: print(f\"{float(r[0]['value'][1]):.2f} cores\")
else: print('(no data)')
" 2>/dev/null)
echo "  CPU usage (5m):    ${CPU_VAL}"

# Memory
MEM_TOTAL=$(pq "machine_memory_bytes{instance=\"${HOSTNAME}\"}")
MEM_TOTAL_VAL=$(echo "$MEM_TOTAL" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r: print(f\"{float(r[0]['value'][1])/1073741824:.1f} GiB\")
else: print('(no data)')
" 2>/dev/null)
echo "  Memory total:      ${MEM_TOTAL_VAL}"

MEM_USAGE=$(pq "sum(container_memory_usage_bytes{instance=\"${HOSTNAME}\",container!=\"\"})")
MEM_USAGE_VAL=$(echo "$MEM_USAGE" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r: print(f\"{float(r[0]['value'][1])/1073741824:.1f} GiB\")
else: print('(no data)')
" 2>/dev/null)
echo "  Memory used:       ${MEM_USAGE_VAL}"

# Power (PCM)
POWER_RESULT=$(pq "Package_Joules_Consumed{instance=\"${HOSTNAME}\"}")
POWER_VAL=$(echo "$POWER_RESULT" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r: print(f'{len(r)} series found')
else: print('(no data)')
" 2>/dev/null)
echo "  PCM Power:         ${POWER_VAL}"

# Jobs for this host
JOBS=$(pq "up{instance=~\"${HOSTNAME}.*\"}")
JOBS_VAL=$(echo "$JOBS" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
r=d.get('data',{}).get('result',[])
if r:
  for x in r:
    j=x['metric'].get('job','?')
    v='UP' if x['value'][1]=='1' else 'DOWN'
    print(f'    {j}: {v}')
else: print('  (no matching targets)')
" 2>/dev/null)
echo "  Active jobs:"
echo "${JOBS_VAL}"

echo ""
echo "========================================"
echo " 검증 완료 — 위 데이터를 DCIM UI와 비교하세요"
echo "========================================"
