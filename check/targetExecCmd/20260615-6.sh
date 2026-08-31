#!/bin/bash
# Lab-3 config 재로드 + 확인 (38.100에서 실행)

PROM="http://10.100.175.248:8080"
POD=$(kubectl get pods -n monitoring -l app=prometheus-server -o jsonpath='{.items[0].metadata.name}')

echo "=== 1. SIGHUP으로 config 재로드 (안전: 오류시 기존 유지) ==="
kubectl exec "$POD" -n monitoring -- kill -HUP 1
echo "OK. 10초 대기..."
sleep 10

echo ""
echo "=== 2. 재로드 후 로그 (에러 확인) ==="
kubectl logs "$POD" -n monitoring --tail=5

echo ""
echo "=== 3. Lab-3 타겟 수 ==="
RESULT=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.131.*%22%7D" 2>/dev/null)
TOTAL=$(echo "$RESULT" | grep -o '"instance"' | wc -l)
UP=$(echo "$RESULT" | grep -o '"1"' | wc -l)
echo "Lab-3: UP=$UP / TOTAL=$TOTAL"

echo ""
echo "=== 4. Lab-1 기존 타겟 (정상 확인) ==="
LAB1=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.38.*%22%7D" 2>/dev/null | grep -o '"instance"' | wc -l)
echo "Lab-1: $LAB1 개"
