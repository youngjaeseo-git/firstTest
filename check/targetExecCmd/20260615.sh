#!/bin/bash
# Lab-3 node-exporter 진단 (131.100에서 실행)

echo "=== 1. Pod 상태 (131.103) ==="
kubectl get pods -n monitoring -l app=node-exporter -o wide | grep 131.103

echo ""
echo "=== 2. listen-address 설정 ==="
kubectl get ds node-exporter -n monitoring -o jsonpath='{.spec.template.spec.containers[0].args}' && echo ""

echo ""
echo "=== 3. Pod 로그 (131.103 노드, 최근 5줄) ==="
POD=$(kubectl get pods -n monitoring -l app=node-exporter -o wide | grep 131.103 | awk '{print $1}')
if [ -n "$POD" ]; then
  kubectl logs "$POD" -n monitoring --tail=5
else
  echo "131.103 노드에 Pod 없음"
fi
