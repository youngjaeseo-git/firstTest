#!/bin/bash
# 2026-06-12-3: Lab-3 node-exporter 활성화 (Lab-1 Prometheus에서 수집)
# ★★★ 131.100 (k8s-master-lab3)에서 실행 ★★★
#
# 3단계:
#   STEP 1: node-exporter DaemonSet에 hostNetwork 활성화
#   STEP 2: Lab-3 각 노드 방화벽에 9100 포트 개방
#   STEP 3: Lab-1 Prometheus ConfigMap 수정 안내 (38.100에서 별도 실행)
#
# 실행 전 반드시 내용을 확인하세요.

set -e

echo "========================================="
echo "STEP 1: node-exporter hostNetwork 패치"
echo "========================================="
echo ""

echo "-- 패치 전 상태 --"
kubectl get ds node-exporter -n monitoring -o jsonpath='hostNetwork={.spec.template.spec.hostNetwork}' 2>/dev/null
echo ""

echo "패치 적용 중..."
kubectl patch ds node-exporter -n monitoring -p '{"spec":{"template":{"spec":{"hostNetwork":true,"dnsPolicy":"ClusterFirstWithHostNet"}}}}' 2>&1

echo ""
echo "Pod 재시작 대기 (30초)..."
sleep 30

echo "-- 패치 후 상태 --"
kubectl get ds node-exporter -n monitoring
echo ""

echo "========================================="
echo "STEP 2: Lab-3 노드 방화벽 9100 포트 개방"
echo "========================================="
echo ""

NODES=(
  10.144.131.100 10.144.131.101 10.144.131.102 10.144.131.103
  10.144.131.104 10.144.131.105 10.144.131.106 10.144.131.107
  10.144.131.108 10.144.131.109 10.144.131.111 10.144.131.112
  10.144.131.113 10.144.131.114 10.144.131.115 10.144.131.116
  10.144.131.117 10.144.131.118 10.144.131.119 10.144.131.120
  10.144.131.151 10.144.131.190
)

for NODE in "${NODES[@]}"; do
  echo -n "$NODE: "
  ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no "$NODE" \
    "firewall-cmd --add-port=9100/tcp --permanent && firewall-cmd --reload" 2>&1 | tail -1
done

echo ""
echo "-- 9100 포트 접근 테스트 --"
for IP in 10.144.131.101 10.144.131.111 10.144.131.190; do
  echo -n "$IP:9100 -> "
  CODE=$(timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://$IP:9100/metrics" 2>/dev/null)
  echo "${CODE:-FAIL}"
done

echo ""
echo "========================================="
echo "STEP 3: Lab-1 Prometheus ConfigMap 수정"
echo "========================================="
echo "★ 이 단계는 38.100 (k8-master)에서 실행 ★"
echo ""
echo "위 테스트에서 200이 나오면, 38.100에서 아래를 실행하세요:"
echo ""
echo "  kubectl edit cm prometheus-server-conf -n monitoring"
echo ""
echo "scrape_configs: 맨 아래에 추가:"
cat << 'YAML_BLOCK'

  - job_name: 'node-exporter-lab3'
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
echo "저장 후 Prometheus Pod 재시작:"
echo "  kubectl delete pod -n monitoring -l app=prometheus-server"
echo ""
echo "=== 끝 ==="
