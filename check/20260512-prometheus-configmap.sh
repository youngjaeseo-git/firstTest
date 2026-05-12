#!/bin/bash
# Prometheus ConfigMap 확인 — scrape job 추가 위치 파악
# 실행: bash check/20260512-prometheus-configmap.sh

echo "=== 1. monitoring 네임스페이스 ConfigMap 목록 ==="
kubectl -n monitoring get configmap 2>&1

echo ""
echo "=== 2. Prometheus ConfigMap 내용 (scrape_configs 부분만) ==="
# 일반적인 이름들 시도
for NAME in prometheus-config prometheus-server prometheus-server-conf prometheus; do
  RESULT=$(kubectl -n monitoring get configmap "$NAME" -o jsonpath='{.data.prometheus\.yml}' 2>/dev/null)
  if [ -n "$RESULT" ]; then
    echo "  ConfigMap name: $NAME"
    echo "  Key: prometheus.yml"
    echo ""
    echo "  [현재 job 목록]"
    echo "$RESULT" | grep "job_name" | head -20
    echo ""
    echo "  [마지막 job 끝부분 — 여기 아래에 node-exporter job 추가]"
    echo "$RESULT" | tail -15
    echo ""
    echo "========================================="
    echo "  추가할 명령어:"
    echo "  kubectl -n monitoring edit configmap $NAME"
    echo ""
    echo "  scrape_configs 섹션 맨 끝에 아래 추가:"
    echo "========================================="
    cat << 'JOBEOF'
    - job_name: 'node-exporter'
      kubernetes_sd_configs:
        - role: node
      relabel_configs:
        - source_labels: [__address__]
          regex: '(.+):.*'
          replacement: '${1}:9100'
          target_label: __address__
        - source_labels: [__meta_kubernetes_node_name]
          target_label: instance
JOBEOF
    exit 0
  fi
done

# yaml 키 시도
for NAME in prometheus-config prometheus-server prometheus-server-conf prometheus; do
  RESULT=$(kubectl -n monitoring get configmap "$NAME" -o jsonpath='{.data.prometheus\.yaml}' 2>/dev/null)
  if [ -n "$RESULT" ]; then
    echo "  ConfigMap name: $NAME"
    echo "  Key: prometheus.yaml"
    echo ""
    echo "  [현재 job 목록]"
    echo "$RESULT" | grep "job_name" | head -20
    echo ""
    echo "  편집: kubectl -n monitoring edit configmap $NAME"
    exit 0
  fi
done

echo ""
echo "  자동 탐지 실패 — 위 ConfigMap 목록에서 prometheus 관련 이름을 확인하세요"
echo "  수동 확인: kubectl -n monitoring get configmap CONFIGMAP_NAME -o yaml"
