#!/bin/bash
# Lab-3 node-exporter 롤아웃 멈춤 진단 (131.100에서 실행)

echo "=== 1. 실제 Pod 라벨 (selector 불일치 확인) ==="
kubectl get pods -n monitoring -o wide 2>&1 | grep node-exporter | head -1
POD=$(kubectl get pods -n monitoring -o wide 2>&1 | grep node-exporter | head -1 | awk '{print $1}')
[ -n "$POD" ] && kubectl get pod "$POD" -n monitoring --show-labels --no-headers | awk '{print $NF}'

echo ""
echo "=== 2. maxUnavailable + selector ==="
kubectl get ds node-exporter -n monitoring -o jsonpath='maxUnavailable={.spec.updateStrategy.rollingUpdate.maxUnavailable} selector={.spec.selector.matchLabels}' && echo ""

echo ""
echo "=== 3. NotReady 노드 (꺼진 서버) ==="
kubectl get nodes --no-headers 2>&1 | grep -v " Ready " | awk '{print $1, $2}'
