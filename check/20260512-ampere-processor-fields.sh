#!/bin/bash
# Ampere 서버 Redfish Processor 엔드포인트 전체 필드 조사
# 목적: 표준 필드(Model, TotalCores, TotalThreads, Manufacturer)가 비어있는 Ampere BMC에서
#        실제 프로세서 정보가 어떤 필드에 있는지 확인
# 실행: bash check/20260512-ampere-processor-fields.sh
#
# 대상: 192.168.10.91 (Lab-1 Ampere 서버 #1)

BMC_IP="192.168.10.91"
BMC_USER="admin"
BMC_PASS="admin"
CURL="curl -sk --connect-timeout 5 -u ${BMC_USER}:${BMC_PASS}"

echo "====================================================="
echo " Ampere Processor 필드 조사: ${BMC_IP}"
echo "====================================================="

# --- 1. Processor/1 전체 JSON (핵심: 어떤 필드에 데이터가 있는지 발견) ---
echo ""
echo "=== 1. /redfish/v1/Systems/1/Processors/1 — 전체 응답 ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1/Processors/1" 2>/dev/null | python3 -c "
import json,sys
try:
  raw = sys.stdin.read()
  d = json.loads(raw)
  # @odata 메타데이터와 Oem 제외하고 모든 필드 출력 (값이 있는 것 우선)
  skip = ['@odata.context','@odata.type','@odata.id','@odata.etag']
  keys = sorted(d.keys())
  print('[Non-null fields]')
  for k in keys:
    if k in skip:
      continue
    v = d.get(k)
    if v is not None and v != '' and v != {} and v != []:
      if isinstance(v, dict):
        print(f'  {k}: {json.dumps(v, indent=4)}')
      elif isinstance(v, list):
        print(f'  {k}: {json.dumps(v, indent=4)}')
      else:
        print(f'  {k}: {v}')
  print()
  print('[Null/empty fields]')
  for k in keys:
    if k in skip:
      continue
    v = d.get(k)
    if v is None or v == '' or v == {} or v == []:
      print(f'  {k}: {repr(v)}')
except Exception as e:
  print(f'Error parsing JSON: {e}')
  print(f'Raw response (first 500 chars): {raw[:500]}')
" 2>/dev/null

# --- 2. Processors 컬렉션 (몇 개의 프로세서가 있는지) ---
echo ""
echo "=== 2. /redfish/v1/Systems/1/Processors — 컬렉션 ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1/Processors" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  members = d.get('Members',[])
  print(f'Processor count: {len(members)}')
  for m in members:
    print(f'  {m.get(\"@odata.id\",\"?\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

# --- 3. Systems/1 ProcessorSummary 섹션 ---
echo ""
echo "=== 3. /redfish/v1/Systems/1 — ProcessorSummary ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  ps = d.get('ProcessorSummary')
  if ps:
    print(json.dumps(ps, indent=2))
  else:
    print('ProcessorSummary: not present')
  # 추가로 Model, Manufacturer 최상위 필드도 확인
  print()
  print(f'System Model: {d.get(\"Model\",\"(not present)\")}')
  print(f'System Manufacturer: {d.get(\"Manufacturer\",\"(not present)\")}')
  print(f'System SKU: {d.get(\"SKU\",\"(not present)\")}')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

# --- 4. Oem 섹션만 별도 출력 (Ampere 전용 필드가 여기 있을 가능성) ---
echo ""
echo "=== 4. Processor/1 — Oem 섹션 (벤더 전용 필드) ==="
$CURL "https://${BMC_IP}/redfish/v1/Systems/1/Processors/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  oem = d.get('Oem')
  if oem:
    print(json.dumps(oem, indent=2))
  else:
    print('Oem: not present or empty')
except Exception as e:
  print(f'Error: {e}')
" 2>/dev/null

echo ""
echo "====================================================="
echo " 완료 — 위 결과를 공유해 주세요"
echo "====================================================="
