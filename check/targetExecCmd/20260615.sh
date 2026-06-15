#!/bin/bash
# Lab-3 node-exporter 네임스페이스 재확인 (131.100에서 실행)

echo "=== 1. node-exporter DaemonSet (전체 네임스페이스) ==="
kubectl get ds --all-namespaces 2>&1 | head -1
kubectl get ds --all-namespaces 2>&1 | grep -i node

echo ""
echo "=== 2. node-exporter Pod (전체 네임스페이스) ==="
kubectl get pods --all-namespaces -o wide 2>&1 | grep -i node-exporter | head -3
