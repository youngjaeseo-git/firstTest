#!/bin/bash
# Lab-3 node-exporter Pod 수동 교체 테스트 (131.100에서 실행)
# 131.103 노드의 Pod 1개만 삭제 → hostNetwork:true로 재생성 확인

echo "=== 1. 131.103 노드의 node-exporter Pod 찾기 ==="
POD=$(kubectl get pods -n monitoring -o wide | grep node-exporter | grep 131.103 | awk '{print $1}')
if [ -z "$POD" ]; then
  echo "131.103에 Pod 없음. s222hx14ae006 노드로 시도..."
  POD=$(kubectl get pods -n monitoring -o wide | grep node-exporter | grep s222hx14ae006 | awk '{print $1}')
fi
if [ -z "$POD" ]; then
  echo "대상 Pod을 찾지 못함. 전체 목록:"
  kubectl get pods -n monitoring -o wide | grep node-exporter | head -5
  exit 1
fi
echo "대상 Pod: $POD"

echo ""
echo "=== 2. 삭제 전 상태 ==="
kubectl get pod "$POD" -n monitoring -o wide --no-headers | awk '{print "IP="$6, "NODE="$7}'

echo ""
echo "=== 3. Pod 삭제 ==="
kubectl delete pod "$POD" -n monitoring
echo "25초 대기 (재생성 대기)..."
sleep 25

echo ""
echo "=== 4. 새 Pod 확인 ==="
NEW_LINE=$(kubectl get pods -n monitoring -o wide | grep node-exporter | grep 131.103)
if [ -z "$NEW_LINE" ]; then
  NEW_LINE=$(kubectl get pods -n monitoring -o wide | grep node-exporter | grep s222hx14ae006)
fi
echo "$NEW_LINE"
NEW_IP=$(echo "$NEW_LINE" | awk '{print $6}')
echo ""
if echo "$NEW_IP" | grep -q "^10\."; then
  echo "OK: Pod IP=$NEW_IP (호스트 IP) → hostNetwork 적용됨"
else
  echo "NG: Pod IP=$NEW_IP (CNI IP) → hostNetwork 미적용"
fi

echo ""
echo "=== 5. 9100 접근 테스트 ==="
NODE_IP=$(echo "$NEW_LINE" | awk '{print $7}')
# NODE가 hostname일 수 있으므로 IP 직접 시도
for IP in "$NEW_IP" "10.144.131.103"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://${IP}:9100/metrics" 2>/dev/null)
  echo "${IP}:9100 → HTTP $CODE"
done
