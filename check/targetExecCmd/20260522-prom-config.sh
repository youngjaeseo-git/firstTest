#!/bin/bash
# 2026-05-22 실행 스크립트 (추가)
# 실행: bash check/targetExecCmd/20260522.sh

PROM=http://10.100.175.248:8080

echo "=== 13. Prometheus ConfigMap 전체 내용 ==="
kubectl get configmap prometheus-config -n monitoring -o yaml 2>/dev/null || \
kubectl get configmap prometheus-server -n monitoring -o yaml 2>/dev/null || \
kubectl get configmap prometheus-config -n default -o yaml 2>/dev/null || \
kubectl get configmap -A | grep -i prom

echo ""
echo "=== 14. Prometheus Deployment/StatefulSet ==="
kubectl get deploy,sts -A | grep -i prom

echo ""
echo "=== 15. node-exporter DaemonSet 상태 ==="
kubectl get ds -A | grep -i node

echo ""
echo "=== 16. node-exporter Pod 상태 (전체) ==="
kubectl get pods -A -l app=node-exporter -o wide 2>/dev/null || \
kubectl get pods -A | grep node-exporter
