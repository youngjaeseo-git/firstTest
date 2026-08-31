#!/usr/bin/env bash
# K8s/TLS 인증서 만기 메트릭 존재 여부 확인
# 목적: 만기 자동 수집 구현 전, 어떤 cert-expiry 메트릭이 Prometheus에 있는지 확인
# 사용: bash check/20260602-k8s-cert-metrics.sh
# 출력 최소화 — 결과를 수동 타이핑하므로 메트릭별 "개수"만 출력

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"

q() {
  # $1 = metric name. 결과 시리즈 개수만 출력
  local n
  n=$(curl -s "${PROM}/api/v1/query" --data-urlencode "query=count(${1})" \
      | grep -o '"value":\[[^]]*\]' | grep -o '[0-9]*"$' | tr -d '"')
  echo "${1}: ${n:-0}"
}

echo "=== cert-expiry 후보 메트릭 (개수) ==="
q "apiserver_client_certificate_expiration_seconds_count"
q "kubelet_certificate_manager_client_ttl_seconds"
q "x509_cert_not_after"
q "ssl_cert_not_after"
q "certmanager_certificate_expiration_timestamp_seconds"
q "cert_exporter_cert_expires_in_seconds"
q "probe_ssl_earliest_cert_expiry"

echo ""
echo "=== 데이터가 있는 메트릭의 라벨 구조 (1개 샘플만) ==="
echo "# 위에서 개수가 1 이상인 메트릭 이름을 아래 M에 넣고 한 줄만 확인"
M="x509_cert_not_after"
curl -s "${PROM}/api/v1/query" --data-urlencode "query=${M}" \
  | grep -o '"metric":{[^}]*}' | head -1
