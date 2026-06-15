#!/bin/bash
# ver6 config 내용 확인 (38.100에서 실행) - 읽기전용

echo "=== 1. ver5 vs ver6 차이 (Lab-3 추가분) ==="
if [ -f /root/dany/prometheus-config-map_ver6.yaml ]; then
  echo "-- ver6에서 131 포함 라인 --"
  grep -n "131\." /root/dany/prometheus-config-map_ver6.yaml
  echo ""
  echo "-- ver6에서 node-exporter job 주변 --"
  grep -n -A2 "node-exporter" /root/dany/prometheus-config-map_ver6.yaml | head -15
else
  echo "ver6 파일 없음"
fi

echo ""
echo "=== 2. Prometheus가 실제 로드한 config에서 node-exporter job ==="
curl -s "http://10.100.175.248:8080/api/v1/status/config" 2>/dev/null | grep -o "job_name.*node" | head -5

echo ""
echo "=== 3. Pod 내부 config 파일에서 131 확인 ==="
POD=$(kubectl get pods -n monitoring -l app=prometheus-server -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$POD" -n monitoring -- grep -c "131\." /etc/prometheus/prometheus.yml 2>/dev/null
echo "건 (0이면 ConfigMap에 Lab-3 미포함)"

echo ""
echo "=== 4. ConfigMap 자체에서 131 확인 ==="
kubectl get cm prometheus-server-conf -n monitoring -o yaml | grep -c "131\."
echo "건"

echo ""
echo "=== 5. hot reload 가능 여부 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -XPOST "http://10.100.175.248:8080/-/reload" 2>/dev/null)
echo "/-/reload → HTTP $CODE (200=가능, 403=비활성)"
