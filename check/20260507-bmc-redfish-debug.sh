#!/bin/bash
# BMC Redfish 디버그 — 실제 응답 확인
# 실행: bash check/20260507-bmc-redfish-debug.sh {BMC_IP} {USER} {PASS}

BMC_IP="${1:?BMC IP 필요}"
BMC_USER="${2:-admin}"
BMC_PASS="${3:-admin}"

echo "====================================================="
echo " Redfish 디버그: $BMC_IP (user: $BMC_USER)"
echo "====================================================="

echo ""
echo "=== 1. /redfish/v1/ (루트) ==="
curl -sk -w "\nHTTP_STATUS: %{http_code}\n" \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/" 2>&1 | head -20

echo ""
echo "=== 2. /redfish/v1/Systems (시스템 목록) ==="
curl -sk -w "\nHTTP_STATUS: %{http_code}\n" \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Systems" 2>&1

echo ""
echo "=== 3. /redfish/v1/Systems/1 (시스템 상세 — PowerState 포함) ==="
curl -sk -w "\nHTTP_STATUS: %{http_code}\n" \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Systems/1" 2>&1 | python3 -c "
import json,sys
raw = sys.stdin.read()
# HTTP_STATUS 라인 분리
lines = raw.rsplit('\n', 2)
body = lines[0] if len(lines) > 1 else raw
status_line = lines[-2] if len(lines) > 1 else ''
print(status_line)
try:
  d = json.loads(body)
  print(f'PowerState: {d.get(\"PowerState\",\"?\")}')
  print(f'Manufacturer: {d.get(\"Manufacturer\",\"?\")}')
  print(f'Model: {d.get(\"Model\",\"?\")}')
  actions = d.get('Actions',{})
  reset = actions.get('#ComputerSystem.Reset', actions.get('ComputerSystem.Reset',{}))
  print(f'Reset target: {reset.get(\"target\",\"?\")}')
  allowed = reset.get('ResetType@Redfish.AllowableValues', 
             reset.get('@Redfish.ActionInfo', '?'))
  print(f'Allowed ResetTypes: {allowed}')
except Exception as e:
  print(f'Parse error: {e}')
  print(body[:500])
" 2>/dev/null

echo ""
echo "=== 4. Systems 경로가 다를 수 있음 — Members 확인 ==="
curl -sk \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Systems" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'Members count: {len(members)}')
  for m in members:
    path = m.get('@odata.id','?')
    print(f'  {path}')
except Exception as e:
  print(f'Parse error: {e}')
" 2>/dev/null

echo ""
echo "=== 5. Reset 테스트 (dry-run — 실제 동작하지 않음) ==="
echo "  아래 명령어를 수동으로 실행하면 실제 재부팅됨:"
echo "  curl -sk -X POST -u '${BMC_USER}:${BMC_PASS}' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"ResetType\":\"ForceRestart\"}' \\"
echo "    'https://${BMC_IP}/redfish/v1/Systems/1/Actions/ComputerSystem.Reset'"
echo ""
echo "  대신 GET으로 Reset Action 정보만 확인:"
curl -sk -w "\nHTTP_STATUS: %{http_code}\n" \
  -u "${BMC_USER}:${BMC_PASS}" \
  "https://${BMC_IP}/redfish/v1/Systems/1/Actions" 2>&1 | head -20

echo ""
echo "====================================================="
echo " 완료"
echo "====================================================="
