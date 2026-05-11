#!/bin/bash
# Lab-3 BMC 접근 가능 여부 확인
# Lab-1 마스터(10.144.38.100)에서 실행
# 실행: bash check/20260512-lab3-bmc-access.sh

echo "=== Lab-3 BMC 접근 테스트 ==="
echo "실행 위치: $(hostname) / $(hostname -I | awk '{print $1}')"
echo ""

# Lab-3 BMC IP 샘플 (GNR-AP, GNR-SP, SRF 각 1개)
TARGETS="192.168.10.101 192.168.10.111 192.168.10.121 192.168.10.211"

for IP in $TARGETS; do
  echo -n "  $IP: "
  # ping 1회 (1초 타임아웃)
  if ping -c1 -W1 "$IP" >/dev/null 2>&1; then
    echo -n "ping=OK, "
  else
    echo "ping=FAIL (unreachable)"
    continue
  fi
  # HTTPS 443 연결 (2초 타임아웃)
  if curl -sk --connect-timeout 2 -m 3 -o /dev/null -w "https=%{http_code}" "https://${IP}/redfish/v1/" 2>/dev/null; then
    echo ""
  else
    echo "https=FAIL"
  fi
done

echo ""
echo "=== 결과 해석 ==="
echo "ping=OK, https=200 → Lab-1에서 Lab-3 BMC 접근 가능"
echo "ping=OK, https=401 → 접근 가능 (인증만 필요)"
echo "ping=FAIL → Lab-3 BMC에 도달 불가 (별도 네트워크 경로 필요)"
echo ""
echo "주의: 192.168.10.101~124는 Lab-1 SPR BMC와 겹침"
echo "→ ping=OK이면 Lab-1 BMC에 연결된 것일 수 있음"
echo "→ curl 응답의 Model/Product로 어느 서버인지 구분 필요:"
echo ""

# 구분 확인: 192.168.10.101이 SPR인지 GNR-AP인지
echo "=== 192.168.10.101 서버 식별 ==="
curl -sk -u admin:admin --connect-timeout 3 -m 5 "https://192.168.10.101/redfish/v1/Systems/1" 2>/dev/null | python3 -c "
import json,sys
try:
  d = json.loads(sys.stdin.read())
  print(f'  Model: {d.get(\"Model\",\"?\")}')
  print(f'  CPU: {d.get(\"ProcessorSummary\",{}).get(\"Model\",\"?\")}')
  print(f'  → SYS-121H-TNR = Lab-1 SPR')
  print(f'  → SYS-222HA-TN = Lab-3 GNR-AP')
except:
  print('  (응답 파싱 실패)')
" 2>/dev/null

echo ""
echo "완료"
