#!/bin/bash
# BMC 프록시 사전 확인 (2단계로 나눠서 실행)
#
# ★ 1단계: Lab-3 마스터(131.100)에서 실행 ★
#   ssh root@10.144.131.100
#   bash 20260615-8.sh lab3
#
# ★ 2단계: Lab-1(38.100)에서 실행 ★
#   bash 20260615-8.sh lab1

MODE="${1:-lab3}"

if [ "$MODE" = "lab3" ]; then
  echo "=== Lab-3 마스터 → BMC 접근 테스트 ==="
  echo "호스트: $(hostname) / $(hostname -I 2>/dev/null | awk '{print $1}')"

  echo ""
  echo "-- 1. BMC 대역(192.168.10.x) ping 테스트 (샘플 3개) --"
  for IP in 192.168.10.103 192.168.10.111 192.168.10.100; do
    R=$(ping -c1 -W2 "$IP" 2>/dev/null && echo "OK" || echo "FAIL")
    echo "$IP: $R" | tail -1
  done

  echo ""
  echo "-- 2. BMC Redfish 접근 (192.168.10.103) --"
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://192.168.10.103/redfish/v1/" 2>/dev/null)
  echo "Redfish HTTP: $CODE"

  echo ""
  echo "-- 3. BMC 네트워크 인터페이스 확인 --"
  ip route | grep 192.168.10 | head -2
  if [ $? -ne 0 ]; then
    echo "192.168.10.x 라우트 없음"
  fi

  echo ""
  echo "-- 4. 프록시 포트 8443 사용 가능 여부 --"
  ss -tlnp | grep 8443 | head -1 || echo "8443 미사용 (사용 가능)"

  echo ""
  echo "-- 5. nginx 설치 여부 --"
  which nginx 2>/dev/null && nginx -v 2>&1 || echo "nginx 미설치"
  which python3 2>/dev/null && echo "python3 있음" || echo "python3 없음"

elif [ "$MODE" = "lab1" ]; then
  echo "=== Lab-1 → Lab-3 마스터 포트 접근 테스트 ==="
  echo "호스트: $(hostname) / $(hostname -I 2>/dev/null | awk '{print $1}')"

  echo ""
  echo "-- 1. Lab-3 마스터 SSH(22) 접근 --"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://10.144.131.100:22" 2>/dev/null)
  echo "131.100:22 응답: $CODE (0이면 TCP는 열림)"
  nc -z -w3 10.144.131.100 22 2>/dev/null && echo "SSH OK" || echo "SSH FAIL"

  echo ""
  echo "-- 2. Lab-3 마스터 8443 포트 (프록시용) --"
  nc -z -w3 10.144.131.100 8443 2>/dev/null && echo "8443 OK" || echo "8443 FAIL (아직 프록시 미설치면 정상)"

  echo ""
  echo "-- 3. Lab-3 마스터 9100 포트 (node-exporter, 이미 확인됨) --"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://10.144.131.100:9100/metrics" 2>/dev/null)
  echo "131.100:9100 HTTP: $CODE"

  echo ""
  echo "-- 4. Lab-1 BMC 직접 접근 (비교용) --"
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 3 "https://192.168.10.103/redfish/v1/" 2>/dev/null)
  echo "Lab-1 BMC 192.168.10.103 HTTP: $CODE"

fi

echo ""
echo "=== 완료 ==="
