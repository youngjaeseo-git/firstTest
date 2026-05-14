#!/bin/bash
# node-exporter 포트 접근 불가 원인 진단
# 실행: bash check/20260514-node-exporter-port-debug.sh

echo "=== 1. DaemonSet hostNetwork 설정 확인 ==="
kubectl -n monitoring get daemonset node-exporter -o jsonpath='{.spec.template.spec.hostNetwork}' 2>&1
echo ""

echo ""
echo "=== 2. GNR-AP (s222hax14ae011) node-exporter 파드 상태 ==="
POD_AP=$(kubectl -n monitoring get pods -l app=node-exporter --field-selector spec.nodeName=s222hax14ae011 -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
echo "  Pod name: $POD_AP"
if [ -n "$POD_AP" ]; then
  echo "  Pod IP:"
  kubectl -n monitoring get pod "$POD_AP" -o jsonpath='{.status.podIP}' 2>&1
  echo ""
  echo "  Host IP:"
  kubectl -n monitoring get pod "$POD_AP" -o jsonpath='{.status.hostIP}' 2>&1
  echo ""
  echo "  Logs (last 10 lines):"
  kubectl -n monitoring logs "$POD_AP" --tail=10 2>&1
fi

echo ""
echo "=== 3. GNR-SP (s222hx14ae021) node-exporter 파드 상태 ==="
POD_SP=$(kubectl -n monitoring get pods -l app=node-exporter --field-selector spec.nodeName=s222hx14ae021 -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
echo "  Pod name: $POD_SP"
if [ -n "$POD_SP" ]; then
  echo "  Pod IP:"
  kubectl -n monitoring get pod "$POD_SP" -o jsonpath='{.status.podIP}' 2>&1
  echo ""
  echo "  Host IP:"
  kubectl -n monitoring get pod "$POD_SP" -o jsonpath='{.status.hostIP}' 2>&1
  echo ""
  echo "  Logs (last 10 lines):"
  kubectl -n monitoring logs "$POD_SP" --tail=10 2>&1
fi

echo ""
echo "=== 4. SPR (정상 서버) node-exporter 파드 비교 ==="
POD_SPR=$(kubectl -n monitoring get pods -l app=node-exporter --field-selector spec.nodeName=s121x13ae003 -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
echo "  Pod name: $POD_SPR"
if [ -n "$POD_SPR" ]; then
  echo "  Pod IP:"
  kubectl -n monitoring get pod "$POD_SPR" -o jsonpath='{.status.podIP}' 2>&1
  echo ""
  echo "  Host IP:"
  kubectl -n monitoring get pod "$POD_SPR" -o jsonpath='{.status.hostIP}' 2>&1
  echo ""
fi

echo ""
echo "=== 5. 마스터에서 각 서버 9100 포트 직접 테스트 ==="
for IP in 10.144.38.103 10.144.38.61 10.144.38.81; do
  CODE=$(curl -s --connect-timeout 3 -m 5 -o /dev/null -w "%{http_code}" "http://$IP:9100/metrics" 2>/dev/null)
  echo "  $IP:9100 -> HTTP $CODE"
done
