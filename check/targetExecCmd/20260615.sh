#!/bin/bash
# Lab-3 node-exporter hostNetwork 진단 (131.100에서 실행)

echo "=== 1. 업데이트 전략 ==="
kubectl get ds node-exporter -n monitoring -o jsonpath='{.spec.updateStrategy.type}' && echo ""

echo ""
echo "=== 2. UP-TO-DATE 현황 ==="
kubectl get ds node-exporter -n monitoring

echo ""
echo "=== 3. Pod IP 확인 (hostNetwork면 10.144.x.x, 아니면 172.x.x.x) ==="
kubectl get pods -n monitoring -l app=node-exporter -o wide 2>&1 | awk 'NR<=4{print}'
