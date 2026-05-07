#!/bin/bash
# BMC 터미널/콘솔 접근 방식 확인
# 실행: bash check/20260506-bmc-terminal.sh > bmc-terminal-result.txt 2>&1
# 주의: BMC_IP, BMC_USER, BMC_PASS 를 실제 값으로 바꿔서 실행

BMC_IP="1.1.2.3"
BMC_USER="abc"
BMC_PASS="123"

echo "====================================================="
echo " BMC 터미널 접근 방식 확인: $BMC_IP"
echo "====================================================="

echo ""
echo "=== 1. ipmitool 설치 여부 ==="
which ipmitool 2>/dev/null && ipmitool -V || echo "X ipmitool not installed"

echo ""
echo "=== 2. IPMI over LAN 응답 확인 ==="
if command -v ipmitool &>/dev/null; then
  timeout 5 ipmitool -I lanplus -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis status 2>&1 | head -10
else
  echo "skip (ipmitool not installed)"
fi

echo ""
echo "=== 3. Redfish 접근 확인 ==="
curl -sk --max-time 5 \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(f'Redfish version: {d.get(\"RedfishVersion\",\"?\")}')
  print(f'Product: {d.get(\"Product\",d.get(\"Description\",\"?\"))}')
  print(f'Vendor: {d.get(\"Vendor\",\"?\")}'  )
except: print('X Redfish not reachable or parse error')
"

echo ""
echo "=== 4. Redfish Serial Console 지원 확인 ==="
curl -sk --max-time 5 \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Managers" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  members = d.get('Members',[])
  print(f'Managers: {len(members)}')
  for m in members:
    print(f'  {m.get(\"@odata.id\",\"?\")}')
except: print('X parse error')
"

echo ""
echo "=== 5. Redfish Manager 상세 (Console/Serial 항목) ==="
curl -sk --max-time 5 \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Managers/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(f'FirmwareVersion: {d.get(\"FirmwareVersion\",\"?\")}')
  print(f'Model: {d.get(\"Model\",\"?\")}')
  # 콘솔 관련 항목 확인
  links = d.get('Links',{})
  actions = d.get('Actions',{})
  console = d.get('SerialConsole',{})
  print(f'SerialConsole: {console}')
  print(f'GraphicalConsole: {d.get(\"GraphicalConsole\",{})}')
except: print('X parse error')
" 2>/dev/null

echo ""
echo "=== 6. BMC 제조사/모델 확인 (Supermicro vs Dell vs HP) ==="
curl -sk --max-time 5 \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Systems/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(f'Manufacturer: {d.get(\"Manufacturer\",\"?\")}')
  print(f'Model: {d.get(\"Model\",\"?\")}')
  print(f'SKU: {d.get(\"SKU\",\"?\")}')
  print(f'PowerState: {d.get(\"PowerState\",\"?\")}')
  # Actions 목록
  actions = d.get('Actions',{}).get('ComputerSystem.Reset',{})
  allowed = actions.get('ResetType@Redfish.AllowableValues', [])
  print(f'Allowed reset types: {allowed}')
except: print('X parse error')
" 2>/dev/null

echo ""
echo "=== 7. ipmitool sol 활성화 여부 확인 ==="
if command -v ipmitool &>/dev/null; then
  timeout 5 ipmitool -I lanplus -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sol info 2>&1 | head -15
else
  echo "skip (ipmitool not installed)"
fi

echo ""
echo "====================================================="
echo " 완료 — BMC IP: $BMC_IP"
echo "====================================================="
