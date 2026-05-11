#!/bin/bash
# GNR-AP vs GNR-SP vs SPR Redfish 비교 — 어떤 엔드포인트가 동작하는지 확인
# 실행: bash check/20260512-gnr-redfish-compare.sh BMC_IP admin PASSWORD SERVER_TYPE
# SERVER_TYPE: SPR, GNR-AP, GNR-SP 중 하나 (출력 라벨용)
#
# 3번 실행 (SPR 1대, GNR-AP 1대, GNR-SP 1대) 후 결과 비교

BMC_IP="${1:?BMC IP 필요}"
BMC_USER="${2:-admin}"
BMC_PASS="${3:-admin}"
TYPE="${4:-UNKNOWN}"

CURL="curl -sk -u ${BMC_USER}:${BMC_PASS} --connect-timeout 5 -m 10"

echo "========================================"
echo " Server Type: $TYPE"
echo " BMC IP: $BMC_IP"
echo "========================================"

# 1. 기본 시스템 정보
echo ""
echo "=== 1. System Info ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'Manufacturer: {d.get(\"Manufacturer\",\"?\")}')
  print(f'Model: {d.get(\"Model\",\"?\")}')
  print(f'BiosVersion: {d.get(\"BiosVersion\",\"?\")}')
  ps = d.get('ProcessorSummary',{})
  print(f'CPU: {ps.get(\"Model\",\"?\")} x{ps.get(\"Count\",\"?\")}')
  ms = d.get('MemorySummary',{})
  print(f'Memory: {ms.get(\"TotalSystemMemoryGiB\",\"?\")} GiB')
  # 어떤 하위 링크가 존재하는지
  links = []
  for k in ['Processors','Memory','EthernetInterfaces','Storage','NetworkInterfaces','SimpleStorage','LogServices']:
    if d.get(k):
      links.append(k)
  print(f'Available links: {links}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

# 2. Chassis 구조 (Thermal/Power 존재 여부)
echo ""
echo "=== 2. Chassis ==="
$CURL "https://${BMC_IP}/redfish/v1/Chassis/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'ChassisType: {d.get(\"ChassisType\",\"?\")}')
  print(f'Manufacturer: {d.get(\"Manufacturer\",\"?\")}')
  links = []
  for k in ['Thermal','Power','Sensors','EnvironmentMetrics','PowerSubsystem','ThermalSubsystem']:
    if d.get(k):
      links.append(k + '=' + str(d[k].get('@odata.id','?')))
  print(f'Available: {links}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

# 3. Thermal
echo ""
echo "=== 3. Thermal ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Chassis/1/Thermal" 2>/dev/null)
echo "HTTP: $STATUS"
if [ "$STATUS" = "200" ]; then
  $CURL "https://${BMC_IP}/redfish/v1/Chassis/1/Thermal" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  temps = d.get('Temperatures',[])
  fans = d.get('Fans',[])
  print(f'Temperatures: {len(temps)}, Fans: {len(fans)}')
  if temps:
    t = temps[0]
    print(f'  Sample: {t.get(\"Name\",\"?\")}: {t.get(\"ReadingCelsius\",\"?\")}C')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
fi

# 3-1. ThermalSubsystem (신규 Redfish 방식)
echo ""
echo "=== 3-1. ThermalSubsystem (new style) ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Chassis/1/ThermalSubsystem" 2>/dev/null)
echo "HTTP: $STATUS"

# 4. Power
echo ""
echo "=== 4. Power ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Chassis/1/Power" 2>/dev/null)
echo "HTTP: $STATUS"
if [ "$STATUS" = "200" ]; then
  $CURL "https://${BMC_IP}/redfish/v1/Chassis/1/Power" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  psus = d.get('PowerSupplies',[])
  ctrl = d.get('PowerControl',[])
  print(f'PSUs: {len(psus)}, PowerControl: {len(ctrl)}')
  if ctrl:
    c = ctrl[0]
    print(f'  Consumed: {c.get(\"PowerConsumedWatts\",\"?\")}W')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
fi

# 4-1. PowerSubsystem (신규 방식)
echo ""
echo "=== 4-1. PowerSubsystem (new style) ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Chassis/1/PowerSubsystem" 2>/dev/null)
echo "HTTP: $STATUS"

# 5. Sensors (신규 방식)
echo ""
echo "=== 5. Sensors collection ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Chassis/1/Sensors" 2>/dev/null)
echo "HTTP: $STATUS"
if [ "$STATUS" = "200" ]; then
  $CURL "https://${BMC_IP}/redfish/v1/Chassis/1/Sensors" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'Sensor count: {len(members)}')
  if members:
    print(f'  First 3: {[m.get(\"@odata.id\",\"?\") for m in members[:3]]}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
fi

# 6. Memory
echo ""
echo "=== 6. Memory ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Systems/1/Memory" 2>/dev/null)
echo "HTTP: $STATUS"
if [ "$STATUS" = "200" ]; then
  $CURL "https://${BMC_IP}/redfish/v1/Systems/1/Memory" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'DIMM count: {len(d.get(\"Members\",[]))}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
fi

# 7. Processors
echo ""
echo "=== 7. Processors ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Systems/1/Processors" 2>/dev/null)
echo "HTTP: $STATUS"
if [ "$STATUS" = "200" ]; then
  $CURL "https://${BMC_IP}/redfish/v1/Systems/1/Processors/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'Model: {d.get(\"Model\",\"?\")}')
  print(f'Cores: {d.get(\"TotalCores\",\"?\")}, Threads: {d.get(\"TotalThreads\",\"?\")}')
  print(f'TDP: {d.get(\"TDPWatts\",\"?\")}W')
  print(f'Arch: {d.get(\"ProcessorArchitecture\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
fi

# 8. EthernetInterfaces
echo ""
echo "=== 8. EthernetInterfaces ==="
STATUS=$($CURL -o /dev/null -w "%{http_code}" "https://${BMC_IP}/redfish/v1/Systems/1/EthernetInterfaces" 2>/dev/null)
echo "HTTP: $STATUS"
if [ "$STATUS" = "200" ]; then
  $CURL "https://${BMC_IP}/redfish/v1/Systems/1/EthernetInterfaces" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'NIC count: {len(d.get(\"Members\",[]))}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
fi

# 9. Redfish 버전
echo ""
echo "=== 9. Redfish Version ==="
$CURL "https://${BMC_IP}/redfish/v1/" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'RedfishVersion: {d.get(\"RedfishVersion\",\"?\")}')
  print(f'Product: {d.get(\"Product\",d.get(\"Name\",\"?\"))}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

echo ""
echo "========================================"
echo " $TYPE 완료"
echo "========================================"
