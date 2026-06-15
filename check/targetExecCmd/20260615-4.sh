#!/bin/bash
# Lab-1 Prometheus에 Lab-3 node-exporter 타겟 추가 (38.100에서 실행)
# ★★★ 이 스크립트는 38.100 (k8s-master)에서 실행하세요 ★★★

set -e

echo "=== Lab-3 node-exporter → Lab-1 Prometheus 등록 ==="

# 1. 현재 ConfigMap 확인
CM_NAME="prometheus-server-conf"
NS="monitoring"

echo "-- 현재 ConfigMap 확인 --"
if ! kubectl get cm "$CM_NAME" -n "$NS" > /dev/null 2>&1; then
  echo "ConfigMap '$CM_NAME' 없음. 이름 검색:"
  kubectl get cm -n "$NS" | grep -i prom
  echo "CM_NAME 변수를 수정하고 다시 실행하세요."
  exit 1
fi
echo "OK: $CM_NAME"

# 2. 이미 등록됐는지 확인
if kubectl get cm "$CM_NAME" -n "$NS" -o yaml | grep -q 'node-exporter-lab3'; then
  echo "이미 node-exporter-lab3 job이 등록되어 있습니다."
  exit 0
fi

# 3. 현재 prometheus.yml 추출
echo "-- 현재 설정 백업 --"
kubectl get cm "$CM_NAME" -n "$NS" -o jsonpath='{.data.prometheus\.yml}' > /tmp/prometheus-backup.yml
echo "백업: /tmp/prometheus-backup.yml ($(wc -l < /tmp/prometheus-backup.yml)줄)"
cp /tmp/prometheus-backup.yml /tmp/prometheus-new.yml

# 4. Lab-3 node-exporter job 추가
# job_name은 'node-exporter-lab3'으로 하되, relabel로 job 라벨을 'node-exporter'로 설정
# → DCIM 앱이 job="node-exporter"로 쿼리하므로 라벨 정합성 유지
cat >> /tmp/prometheus-new.yml << 'EOF'

  - job_name: 'node-exporter-lab3'
    scrape_interval: 15s
    static_configs:
      - targets:
        - '10.144.131.100:9100'
        - '10.144.131.103:9100'
        - '10.144.131.104:9100'
        - '10.144.131.105:9100'
        - '10.144.131.107:9100'
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
    relabel_configs:
      - target_label: job
        replacement: node-exporter
EOF

echo "-- Lab-3 타겟 18개 추가됨 --"

# 5. ConfigMap 업데이트
echo "-- ConfigMap 적용 --"
kubectl create cm "$CM_NAME" -n "$NS" \
  --from-file=prometheus.yml=/tmp/prometheus-new.yml \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "=== Prometheus Pod 재시작 ==="
kubectl delete pod -n "$NS" -l app=prometheus-server
echo "30초 대기..."
sleep 30

echo ""
echo "=== 검증: Lab-3 타겟 상태 ==="
PROM_POD=$(kubectl get pods -n "$NS" -l app=prometheus-server -o name | head -1)
if [ -n "$PROM_POD" ]; then
  kubectl exec "$PROM_POD" -n "$NS" -- wget -qO- "http://localhost:9090/api/v1/targets?state=active" 2>/dev/null \
    | grep -o '"10\.144\.131\.[0-9]*:9100[^}]*health":"[^"]*"' | head -5
  echo "(Lab-3 타겟 일부 표시)"
else
  echo "Prometheus Pod 확인 불가. 수동 확인:"
  echo "  curl 'http://10.100.175.248:8080/api/v1/targets' | grep 131"
fi

echo ""
echo "=== 완료 ==="
echo "꺼진 서버 4대(101,102,106,108)는 타겟 목록에서 제외했습니다."
echo "DCIM 대시보드에서 Lab-3 서버 메트릭이 보이는지 확인하세요."
