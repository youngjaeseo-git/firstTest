#!/bin/bash
# 2026-06-12-3: Lab-3 node-exporter hostNetwork 패치 + Prometheus 설정 수정
# ★★★ 131.100 (k8s-master-lab3)에서 실행 ★★★
#
# 2단계로 구성:
#   STEP 1: node-exporter DaemonSet에 hostNetwork 활성화
#   STEP 2: Prometheus ConfigMap에 node-exporter job 추가
#
# 실행 전 반드시 내용을 확인하세요.

set -e

echo "========================================="
echo "STEP 1: node-exporter hostNetwork 패치"
echo "========================================="
echo ""

# 현재 상태 확인
echo "-- 패치 전 상태 --"
kubectl get ds node-exporter -n monitoring -o jsonpath='hostNetwork={.spec.template.spec.hostNetwork}' 2>/dev/null
echo ""

# hostNetwork: true + dnsPolicy 변경 (hostNetwork 시 필요)
echo "패치 적용 중..."
kubectl patch ds node-exporter -n monitoring -p '{"spec":{"template":{"spec":{"hostNetwork":true,"dnsPolicy":"ClusterFirstWithHostNet"}}}}' 2>&1

echo ""
echo "Pod 재시작 대기 (30초)..."
sleep 30

# 패치 후 확인
echo "-- 패치 후 상태 --"
kubectl get ds node-exporter -n monitoring
echo ""

# 9100 포트 접근 테스트
echo "-- 9100 포트 테스트 --"
for IP in 10.144.131.101 10.144.131.111 10.144.131.190; do
  echo -n "$IP:9100 -> "
  CODE=$(timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://$IP:9100/metrics" 2>/dev/null)
  echo "${CODE:-FAIL}"
done

echo ""
echo "========================================="
echo "STEP 2: Prometheus ConfigMap 확인"
echo "========================================="
echo ""

# ConfigMap 데이터 키 확인
echo "-- ConfigMap 데이터 키 --"
kubectl get cm prometheus-server-conf -n monitoring -o json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for k in d.get('data',{}).keys(): print(f'  key: {k}')
" 2>/dev/null || echo "확인 실패"

echo ""
echo "========================================="
echo "STEP 1 결과가 200이면, STEP 2를 이어서 진행합니다."
echo "아래 안내를 확인하세요."
echo "========================================="
echo ""
echo "ConfigMap 수정 명령어 (STEP 1 성공 후 실행):"
echo "  kubectl edit cm prometheus-server-conf -n monitoring"
echo ""
echo "scrape_configs: 섹션 맨 아래에 추가할 내용:"
cat << 'YAML_BLOCK'

  - job_name: 'node-exporter'
    scrape_interval: 15s
    static_configs:
      - targets:
        - '10.144.131.100:9100'
        - '10.144.131.101:9100'
        - '10.144.131.102:9100'
        - '10.144.131.103:9100'
        - '10.144.131.104:9100'
        - '10.144.131.105:9100'
        - '10.144.131.106:9100'
        - '10.144.131.107:9100'
        - '10.144.131.108:9100'
        - '10.144.131.109:9100'
        - '10.144.131.111:9100'
        - '10.144.131.112:9100'
        - '10.144.131.113:9100'
        - '10.144.131.114:9100'
        - '10.144.131.115:9100'
        - '10.144.131.116:9100'
        - '10.144.131.117:9100'
        - '10.144.131.118:9100'
        - '10.144.131.119:9100'
        - '10.144.131.120:9100'
        - '10.144.131.151:9100'
        - '10.144.131.190:9100'

YAML_BLOCK

echo ""
echo "ConfigMap 저장 후 Prometheus Pod 재시작:"
echo "  kubectl delete pod -n monitoring -l app=prometheus-server"
echo ""
echo "=== 끝 ==="
