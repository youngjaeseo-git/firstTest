#!/bin/bash
# Redfish 확장 엔드포인트 확인 — Storage, Thermal, Power, Memory, EthernetInterfaces
# 실행: bash check/20260507-redfish-extended.sh 192.168.10.11 admin YOUR_PASSWORD
#
# 출력 최소화: 각 엔드포인트에서 핵심 필드 1개 샘플만 추출

BMC_IP="${1:?BMC IP 필요}"
BMC_USER="${2:-admin}"
BMC_PASS="${3:-admin}"

CURL="curl -sk -u ${BMC_USER}:${BMC_PASS}"

echo "====================================================="
echo " Redfish 확장 엔드포인트: $BMC_IP"
echo "====================================================="

# --- 1. Chassis 목록 (Thermal/Power가 Chassis 하위) ---
echo ""
echo "=== 1. Chassis 목록 ==="
$CURL "https://${BMC_IP}/redfish/v1/Chassis" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'Chassis count: {len(members)}')
  for m in members:
    print(f'  {m.get(\"@odata.id\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

# --- 2. Thermal (온도 센서, 팬) ---
echo ""
echo "=== 2. Thermal (첫 번째 Chassis) ==="
$CURL "https://${BMC_IP}/redfish/v1/Chassis/1/Thermal" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  temps = d.get('Temperatures',[])
  fans = d.get('Fans',[])
  print(f'Temperature sensors: {len(temps)}')
  if temps:
    t = temps[0]
    print(f'  Sample: Name={t.get(\"Name\",\"?\")}, Reading={t.get(\"ReadingCelsius\",\"?\")}C, Upper={t.get(\"UpperThresholdCritical\",\"?\")}C')
    # 센서 이름 목록만
    names = [x.get('Name','?') for x in temps]
    print(f'  All names: {names}')
  print(f'Fan sensors: {len(fans)}')
  if fans:
    f = fans[0]
    print(f'  Sample: Name={f.get(\"Name\",\"?\")}, Reading={f.get(\"Reading\",\"?\")}, Unit={f.get(\"ReadingUnits\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
  # HTTP 에러일 수 있음
  print('(Thermal endpoint may not exist on this chassis)')
" 2>/dev/null

# --- 3. Power (PSU, 전력 소비) ---
echo ""
echo "=== 3. Power (첫 번째 Chassis) ==="
$CURL "https://${BMC_IP}/redfish/v1/Chassis/1/Power" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  psus = d.get('PowerSupplies',[])
  ctrl = d.get('PowerControl',[])
  print(f'PowerSupplies: {len(psus)}')
  if psus:
    p = psus[0]
    print(f'  Sample: Name={p.get(\"Name\",\"?\")}, Model={p.get(\"Model\",\"?\")}, Capacity={p.get(\"PowerCapacityWatts\",\"?\")}W, Type={p.get(\"PowerSupplyType\",\"?\")}')
  print(f'PowerControl entries: {len(ctrl)}')
  if ctrl:
    c = ctrl[0]
    consumed = c.get('PowerConsumedWatts', '?')
    cap = c.get('PowerCapacityWatts', '?')
    limit = c.get('PowerLimit', {})
    print(f'  Consumed: {consumed}W, Capacity: {cap}W, Limit: {limit}')
except Exception as e:
  print(f'Error: {e}')
  print('(Power endpoint may not exist on this chassis)')
" 2>/dev/null

# --- 4. Storage (디스크, RAID) ---
echo ""
echo "=== 4. Storage ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1/Storage" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'Storage controllers: {len(members)}')
  for m in members:
    print(f'  {m.get(\"@odata.id\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
  print('(Storage endpoint may not exist)')
" 2>/dev/null

# 첫 번째 Storage controller 상세
echo ""
echo "=== 4-1. 첫 번째 Storage controller 상세 ==="
# 먼저 첫 번째 member path를 가져옴
STORAGE_PATH=$($CURL "https://${BMC_IP}/redfish/v1/Systems/1/Storage" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  if members:
    print(members[0].get('@odata.id',''))
except: pass
" 2>/dev/null)

if [ -n "$STORAGE_PATH" ]; then
  $CURL "https://${BMC_IP}${STORAGE_PATH}" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'Id: {d.get(\"Id\",\"?\")}')
  print(f'Name: {d.get(\"Name\",\"?\")}')
  drives = d.get('Drives',[])
  print(f'Drives: {len(drives)}')
  if drives:
    print(f'  First drive path: {drives[0].get(\"@odata.id\",\"?\")}')
  vols = d.get('Volumes',{}).get('@odata.id','?')
  print(f'Volumes path: {vols}')
  ctrls = d.get('StorageControllers',[])
  print(f'StorageControllers: {len(ctrls)}')
  if ctrls:
    c = ctrls[0]
    print(f'  Controller: {c.get(\"Model\",\"?\")}, FW={c.get(\"FirmwareVersion\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
else
  echo "  No storage controller found"
fi

# 첫 번째 Drive 상세
echo ""
echo "=== 4-2. 첫 번째 Drive 상세 ==="
DRIVE_PATH=""
if [ -n "$STORAGE_PATH" ]; then
  DRIVE_PATH=$($CURL "https://${BMC_IP}${STORAGE_PATH}" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  drives = d.get('Drives',[])
  if drives:
    print(drives[0].get('@odata.id',''))
except: pass
" 2>/dev/null)
fi

if [ -n "$DRIVE_PATH" ]; then
  $CURL "https://${BMC_IP}${DRIVE_PATH}" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'Id: {d.get(\"Id\",\"?\")}')
  print(f'Name: {d.get(\"Name\",\"?\")}')
  print(f'MediaType: {d.get(\"MediaType\",\"?\")}')
  cap = d.get('CapacityBytes')
  if cap:
    print(f'Capacity: {round(cap/1024/1024/1024)}GB ({cap} bytes)')
  else:
    print(f'Capacity: ?')
  print(f'Manufacturer: {d.get(\"Manufacturer\",\"?\")}')
  print(f'Model: {d.get(\"Model\",\"?\")}')
  print(f'SerialNumber: {d.get(\"SerialNumber\",\"?\")}')
  print(f'Protocol: {d.get(\"Protocol\",\"?\")}')
  print(f'RotationSpeedRPM: {d.get(\"RotationSpeedRPM\",\"?\")}')
  print(f'Status: {d.get(\"Status\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
else
  echo "  No drive found"
fi

# --- 5. Memory (DIMM 1개 샘플) ---
echo ""
echo "=== 5. Memory (DIMM 샘플 1개) ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1/Memory" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'DIMM slots: {len(members)}')
  if members:
    print(f'  First: {members[0].get(\"@odata.id\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

# 첫 번째 DIMM 상세
DIMM_PATH=$($CURL "https://${BMC_IP}/redfish/v1/Systems/1/Memory" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  if members:
    print(members[0].get('@odata.id',''))
except: pass
" 2>/dev/null)

if [ -n "$DIMM_PATH" ]; then
  $CURL "https://${BMC_IP}${DIMM_PATH}" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  keys = sorted(d.keys())
  skip = ['@odata.context','@odata.type','@odata.id','@odata.etag','Oem']
  print('  Fields available:')
  for k in keys:
    if k not in skip and not k.startswith('@'):
      v = d.get(k)
      # 값이 dict/list면 타입만
      if isinstance(v, (dict,list)):
        print(f'    {k}: ({type(v).__name__}, len={len(v)})')
      else:
        print(f'    {k}: {v}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
else
  echo "  No DIMM found"
fi

# --- 6. EthernetInterfaces (NIC 1개 샘플) ---
echo ""
echo "=== 6. EthernetInterfaces (NIC 샘플 1개) ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1/EthernetInterfaces" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'NIC count: {len(members)}')
  for m in members:
    print(f'  {m.get(\"@odata.id\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

NIC_PATH=$($CURL "https://${BMC_IP}/redfish/v1/Systems/1/EthernetInterfaces" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  if members:
    print(members[0].get('@odata.id',''))
except: pass
" 2>/dev/null)

if [ -n "$NIC_PATH" ]; then
  $CURL "https://${BMC_IP}${NIC_PATH}" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'  Name: {d.get(\"Name\",\"?\")}')
  print(f'  MACAddress: {d.get(\"MACAddress\",\"?\")}')
  print(f'  SpeedMbps: {d.get(\"SpeedMbps\",\"?\")}')
  print(f'  LinkStatus: {d.get(\"LinkStatus\",\"?\")}')
  print(f'  IPv4: {d.get(\"IPv4Addresses\",\"?\")}')
  print(f'  Status: {d.get(\"Status\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null
else
  echo "  No NIC found"
fi

echo ""
echo "====================================================="
echo " 완료 — 위 결과를 공유해 주세요"
echo "====================================================="
