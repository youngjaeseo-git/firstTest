#!/bin/bash
# 서버별 모니터링 가능 여부 빠른 진단
# 실행: bash check/20260514-server-reachability.sh

PROM=http://10.100.175.248:8080

# 확인할 서버 목록 (HOST_IP HOSTNAME BMC_IP MODEL)
SERVERS=(
  "10.144.38.103 s121x13ae003 192.168.10.103 SPR"
  "10.144.38.61 s222hax14ae011 192.168.10.61 GNR-AP"
  "10.144.38.81 x121x13ae003 192.168.10.81 GNR-SP"
  "10.144.38.91 x121x13ae003 192.168.10.91 Ampere"
)

echo "================================================================"
echo " 서버별 모니터링 가능 여부 진단"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"

for ENTRY in "${SERVERS[@]}"; do
  read -r HOST_IP HOSTNAME BMC_IP MODEL <<< "$ENTRY"

  echo ""
  echo "--- [$MODEL] $HOSTNAME (IP=$HOST_IP, BMC=$BMC_IP) ---"

  # 1. 호스트 ping
  if ping -c 1 -W 2 "$HOST_IP" > /dev/null 2>&1; then
    echo "  [1] Host ping ($HOST_IP): OK"
  else
    echo "  [1] Host ping ($HOST_IP): FAIL - 서버 꺼짐 또는 네트워크 불가"
  fi

  # 2. BMC ping
  if ping -c 1 -W 2 "$BMC_IP" > /dev/null 2>&1; then
    echo "  [2] BMC ping ($BMC_IP): OK"
  else
    echo "  [2] BMC ping ($BMC_IP): FAIL - BMC 접근 불가"
  fi

  # 3. node-exporter 포트 (9100) 접근
  if curl -s --connect-timeout 3 -o /dev/null -w "%{http_code}" "http://$HOST_IP:9100/metrics" 2>/dev/null | grep -q "200"; then
    echo "  [3] node-exporter ($HOST_IP:9100): OK"
  else
    echo "  [3] node-exporter ($HOST_IP:9100): FAIL - 포트 안열림 또는 미설치"
  fi

  # 4. Prometheus에서 이 서버의 타겟 확인 (hostname 기준)
  TARGETS_HOST=$(curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
matched=[t for t in targets if '$HOSTNAME' in t['labels'].get('instance','')]
for t in matched:
    j=t['labels'].get('job','?')
    h=t.get('health','?')
    print('    job=' + j + ' health=' + h + ' instance=' + t['labels'].get('instance','?'))
if not matched: print('    (hostname으로 매칭되는 타겟 없음)')
" 2>/dev/null)
  echo "  [4] Prometheus 타겟 (hostname=$HOSTNAME):"
  echo "$TARGETS_HOST"

  # 5. Prometheus에서 이 서버의 타겟 확인 (IP 기준)
  TARGETS_IP=$(curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
matched=[t for t in targets if '$HOST_IP' in t['labels'].get('instance','')]
for t in matched:
    j=t['labels'].get('job','?')
    h=t.get('health','?')
    print('    job=' + j + ' health=' + h + ' instance=' + t['labels'].get('instance','?'))
if not matched: print('    (IP로 매칭되는 타겟 없음)')
" 2>/dev/null)
  echo "  [5] Prometheus 타겟 (IP=$HOST_IP):"
  echo "$TARGETS_IP"

  # 6. BMC Redfish 접근
  BMC_STATUS=$(curl -sk -u admin:admin --connect-timeout 5 -o /dev/null -w "%{http_code}" "https://$BMC_IP/redfish/v1/Systems/1" 2>/dev/null)
  if [ "$BMC_STATUS" = "200" ]; then
    POWER=$(curl -sk -u admin:admin --connect-timeout 5 "https://$BMC_IP/redfish/v1/Systems/1" 2>/dev/null | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
print(d.get('PowerState','?'))
" 2>/dev/null)
    echo "  [6] BMC Redfish: OK (PowerState=$POWER)"
  else
    echo "  [6] BMC Redfish: FAIL (HTTP $BMC_STATUS)"
  fi

done

echo ""
echo "================================================================"
echo " 진단 완료"
echo ""
echo " FAIL 항목 해석:"
echo "   Host ping FAIL     = 서버 꺼짐 또는 IP 변경"
echo "   BMC ping FAIL      = BMC IP 변경 또는 네트워크 분리"
echo "   node-exporter FAIL = DaemonSet 미배포 또는 서버 꺼짐"
echo "   Prometheus 타겟 없음 = ConfigMap에 해당 서버 미등록"
echo "   BMC Redfish FAIL   = BMC 접근 불가 또는 인증 실패"
echo "   PowerState=Off     = 서버 전원 꺼짐 (BMC만 동작)"
echo "================================================================"
