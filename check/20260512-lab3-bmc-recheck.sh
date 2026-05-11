#!/bin/bash
# Lab-3 BMC 접근 재확인 — ping 무관하게 HTTPS도 시도
# Lab-1 마스터에서 실행: bash check/20260512-lab3-bmc-recheck.sh
#
# Lab-3 BMC IP 중 충돌하지 않는 대역(211~212)과
# 충돌 대역(101~109) 모두 테스트

echo "========================================"
echo " Lab-3 BMC 접근 재확인"
echo " 실행 위치: $(hostname)"
echo "========================================"

# Lab-3 GNR-AP: 192.168.10.101~109 (Lab-1 SPR과 충돌)
# Lab-3 GNR-SP: 192.168.10.111~120 (Lab-1 SPR과 충돌)
# Lab-3 SRF:    192.168.10.121~124 (Lab-1 SPR과 충돌)
# Lab-3 SPR:    192.168.10.211~212 (충돌 없음)

# 각 타입에서 켜져있을 가능성 있는 IP 테스트
TARGETS=(
  "192.168.10.101:Lab3-GNR-AP-or-Lab1-SPR"
  "192.168.10.102:Lab3-GNR-AP-or-Lab1-SPR"
  "192.168.10.103:Lab3-GNR-AP-or-Lab1-SPR"
  "192.168.10.111:Lab3-GNR-SP-or-Lab1-SPR"
  "192.168.10.112:Lab3-GNR-SP-or-Lab1-SPR"
  "192.168.10.211:Lab3-SPR-only"
  "192.168.10.212:Lab3-SPR-only"
)

echo ""
echo "=== 1. Ping + HTTPS 테스트 ==="
for entry in "${TARGETS[@]}"; do
  IP="${entry%%:*}"
  LABEL="${entry##*:}"

  echo -n "  $IP ($LABEL): "

  # ping
  if ping -c1 -W1 "$IP" >/dev/null 2>&1; then
    echo -n "ping=OK "
  else
    echo -n "ping=FAIL "
  fi

  # HTTPS (ping 결과와 무관하게 항상 시도)
  HTTP_CODE=$(curl -sk --connect-timeout 3 -m 5 -o /dev/null -w "%{http_code}" "https://${IP}/redfish/v1/" 2>/dev/null)
  if [ "$HTTP_CODE" = "000" ]; then
    echo "https=TIMEOUT"
  else
    echo "https=$HTTP_CODE"
  fi
done

echo ""
echo "=== 2. 응답한 서버 식별 (어느 Lab 서버인지) ==="
# HTTPS 200 또는 401 받은 서버의 모델명으로 Lab 구분
for entry in "${TARGETS[@]}"; do
  IP="${entry%%:*}"
  LABEL="${entry##*:}"

  HTTP_CODE=$(curl -sk --connect-timeout 3 -m 5 -o /dev/null -w "%{http_code}" "https://${IP}/redfish/v1/" 2>/dev/null)

  if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "000" ]; then
    echo ""
    echo "  --- $IP ($LABEL) ---"
    curl -sk -u admin:admin --connect-timeout 3 -m 5 "https://${IP}/redfish/v1/Systems/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  model = d.get('Model','?')
  cpu = d.get('ProcessorSummary',{}).get('Model','?')
  mem = d.get('MemorySummary',{}).get('TotalSystemMemoryGiB','?')
  print(f'  Model: {model}')
  print(f'  CPU: {cpu}')
  print(f'  Memory: {mem} GiB')
  if 'SYS-121H-TNR' in str(model):
    print(f'  → Lab-1 SPR')
  elif 'SYS-222HA' in str(model):
    print(f'  → GNR-AP (Lab-1 or Lab-3)')
  elif 'SYS-222H-TN' in str(model):
    print(f'  → GNR-SP (Lab-1 or Lab-3)')
  elif 'R13SPD' in str(model):
    print(f'  → Ampere (Lab-1)')
  else:
    print(f'  → 식별 불가')
except:
  print('  (응답 없음 또는 인증 실패)')
" 2>/dev/null
  fi
done

echo ""
echo "========================================"
echo " 완료"
echo "========================================"
