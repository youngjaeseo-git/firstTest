#!/bin/bash
# 서버별 모니터링 가능 여부 빠른 진단
# 실행: bash check/20260514-server-reachability.sh
#
# BMC 비밀번호가 다르면 아래 SERVERS 배열에서 서버별로 수정

PROM=http://10.100.175.248:8080

# BMC 공통 인증 (서버별로 다르면 아래에서 개별 지정)
BMC_USER="admin"
BMC_PASS="admin"

# 확인할 서버 목록 (HOST_IP HOSTNAME BMC_IP MODEL BMC_PASS)
# BMC_PASS를 5번째에 넣으면 서버별 비밀번호 사용, 없으면 위 공통값 사용
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

# Prometheus 타겟 목록을 한 번만 가져옴 (속도 개선)
echo ""
echo "  Prometheus 타겟 로딩 중..."
TARGETS_JSON=$(curl -s --connect-timeout 5 -m 10 "$PROM/api/v1/targets" 2>/dev/null)
if [ -z "$TARGETS_JSON" ]; then
  echo "  WARNING: Prometheus 타겟 조회 실패"
  TARGETS_JSON='{"data":{"activeTargets":[]}}'
fi
echo "  완료"

for ENTRY in "${SERVERS[@]}"; do
  read -r HOST_IP HOSTNAME BMC_IP MODEL PASS_OVERRIDE <<< "$ENTRY"
  PASS="${PASS_OVERRIDE:-$BMC_PASS}"

  echo ""
  echo "--- [$MODEL] $HOSTNAME (IP=$HOST_IP, BMC=$BMC_IP) ---"

  # 1. 호스트 ping
  if ping -c 1 -W 2 "$HOST_IP" > /dev/null 2>&1; then
    echo "  [1] Host ping ($HOST_IP): OK"
  else
    echo "  [1] Host ping ($HOST_IP): FAIL"
  fi

  # 2. BMC ping
  if ping -c 1 -W 2 "$BMC_IP" > /dev/null 2>&1; then
    echo "  [2] BMC ping ($BMC_IP): OK"
  else
    echo "  [2] BMC ping ($BMC_IP): FAIL"
  fi

  # 3. node-exporter 포트 (9100)
  HTTP_CODE=$(curl -s --connect-timeout 3 -m 5 -o /dev/null -w "%{http_code}" "http://$HOST_IP:9100/metrics" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  [3] node-exporter ($HOST_IP:9100): OK"
  else
    echo "  [3] node-exporter ($HOST_IP:9100): FAIL (HTTP $HTTP_CODE)"
  fi

  # 4. Prometheus 타겟 (hostname + IP 동시 확인, 캐시 사용)
  echo "$TARGETS_JSON" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
hostname='$HOSTNAME'
host_ip='$HOST_IP'
found=False
for t in targets:
    inst=t['labels'].get('instance','')
    if hostname in inst or host_ip in inst:
        j=t['labels'].get('job','?')
        h=t.get('health','?')
        print('  [4] Prometheus: job=' + j + ' health=' + h + ' instance=' + inst)
        found=True
if not found:
    print('  [4] Prometheus: 타겟 없음 (hostname=' + hostname + ', IP=' + host_ip + ')')
" 2>/dev/null

  # 5. BMC Redfish
  BMC_RESP=$(curl -sk -u "${BMC_USER}:${PASS}" --connect-timeout 5 -m 10 "https://$BMC_IP/redfish/v1/Systems/1" 2>/dev/null)
  if [ -n "$BMC_RESP" ]; then
    echo "$BMC_RESP" | python3 -c "
import json,sys
try:
    d=json.loads(sys.stdin.read())
    if 'error' in d or 'Error' in str(d.get('error','')):
        print('  [5] BMC Redfish: 인증 실패 (비밀번호 확인 필요)')
    else:
        ps=d.get('PowerState','?')
        model=d.get('Model','?')
        print('  [5] BMC Redfish: OK (PowerState=' + str(ps) + ', Model=' + str(model) + ')')
except:
    print('  [5] BMC Redfish: 응답 파싱 실패')
" 2>/dev/null
  else
    echo "  [5] BMC Redfish: FAIL (응답 없음)"
  fi

done

echo ""
echo "================================================================"
echo " 진단 완료"
echo ""
echo " FAIL 해석:"
echo "   Host ping FAIL       = 서버 꺼짐 또는 IP 변경"
echo "   BMC ping FAIL        = BMC IP 변경 또는 네트워크 분리"
echo "   node-exporter FAIL   = DaemonSet 미배포 또는 서버 꺼짐"
echo "   Prometheus 타겟 없음 = ConfigMap에 해당 서버 미등록"
echo "   BMC 인증 실패        = 비밀번호 확인 (SERVERS 배열에 5번째 값으로 지정)"
echo "   PowerState=Off       = 서버 전원 꺼짐 (BMC만 동작)"
echo "================================================================"
