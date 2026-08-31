#!/bin/bash
# Prometheus 상태 긴급 진단 (38.100에서 실행) - 읽기전용, 변경 없음
# ★★★ 38.100 (k8s-master)에서 실행 ★★★

PROM="http://10.100.175.248:8080"

echo "============================================"
echo "  Prometheus 긴급 진단 (읽기전용)"
echo "============================================"

echo ""
echo "=== 1. Pod 상태 ==="
kubectl get pods -n monitoring -l app=prometheus-server -o wide

echo ""
echo "=== 2. Prometheus 응답 확인 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$PROM/api/v1/status/config")
echo "HTTP: $CODE"
if [ "$CODE" != "200" ]; then
  echo "CRITICAL: Prometheus 응답 없음!"
  echo "Pod 로그:"
  kubectl logs -n monitoring -l app=prometheus-server --tail=10
  exit 1
fi
echo "OK: Prometheus 응답 정상"

echo ""
echo "=== 3. 기존 Lab-1 타겟 (가장 중요 - 깨졌는지 확인) ==="
LAB1_UP=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.38.*%22%7D" 2>/dev/null | grep -c '"1"')
LAB1_TOTAL=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.38.*%22%7D" 2>/dev/null | grep -c '"instance"')
echo "Lab-1 node-exporter: ${LAB1_UP}/${LAB1_TOTAL} UP"
if [ "$LAB1_TOTAL" -eq 0 ]; then
  echo "WARNING: Lab-1 타겟 0개 → 기존 모니터링이 깨졌을 수 있음!"
else
  echo "OK: 기존 Lab-1 모니터링 정상"
fi

echo ""
echo "=== 4. Lab-3 타겟 (새로 추가한 것) ==="
LAB3_UP=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.131.*%22%7D" 2>/dev/null | grep -c '"1"')
LAB3_TOTAL=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.131.*%22%7D" 2>/dev/null | grep -c '"instance"')
echo "Lab-3 node-exporter: ${LAB3_UP}/${LAB3_TOTAL} UP"

echo ""
echo "=== 5. 전체 job별 타겟 수 ==="
curl -s "$PROM/api/v1/targets?state=active" 2>/dev/null | grep -o '"job":"[^"]*"' | sort | uniq -c | sort -rn | head -10

echo ""
echo "=== 6. 실제 로드된 config에 131 포함 여부 ==="
HAS_131=$(curl -s "$PROM/api/v1/status/config" 2>/dev/null | grep -c "131\.")
echo "config 내 131.x 참조: ${HAS_131}건"
if [ "$HAS_131" -eq 0 ]; then
  echo "→ config에 Lab-3 타겟 없음 (ConfigMap 적용 안 됐거나 key 불일치)"
fi

echo ""
echo "=== 7. 롤백용 백업 파일 확인 ==="
for F in /tmp/prometheus-backup.yml /root/dany/prometheus-config-map_ver5.yaml /root/dany/prometheus-config-map_ver6.yaml; do
  if [ -f "$F" ]; then
    echo "EXISTS: $F ($(wc -l < "$F")줄)"
  else
    echo "MISSING: $F"
  fi
done

echo ""
echo "============================================"
echo "  진단 완료. 위 결과를 알려주세요."
echo "============================================"
