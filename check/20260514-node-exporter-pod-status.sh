#!/bin/bash
# node-exporter DaemonSet 파드 상태 확인 — 어떤 노드에서 실행 중인지
# 실행: bash check/20260514-node-exporter-pod-status.sh

echo "=== 1. node-exporter DaemonSet 상태 ==="
kubectl -n monitoring get daemonset node-exporter 2>&1

echo ""
echo "=== 2. node-exporter 파드 상태 (전체) ==="
kubectl -n monitoring get pods -l app=node-exporter -o wide 2>&1

echo ""
echo "=== 3. GNR-AP 노드 확인 (s222hax14ae011) ==="
kubectl get node s222hax14ae011 2>&1 | head -3
echo ""
echo "  해당 노드의 node-exporter 파드:"
kubectl -n monitoring get pods -l app=node-exporter --field-selector spec.nodeName=s222hax14ae011 -o wide 2>&1

echo ""
echo "=== 4. GNR-SP 노드 확인 (s222hx14ae021) ==="
kubectl get node s222hx14ae021 2>&1 | head -3
echo ""
echo "  해당 노드의 node-exporter 파드:"
kubectl -n monitoring get pods -l app=node-exporter --field-selector spec.nodeName=s222hx14ae021 -o wide 2>&1

echo ""
echo "=== 5. Ampere 노드 확인 (s211mr13ae001) ==="
kubectl get node s211mr13ae001 2>&1 | head -3

echo ""
echo "=== 6. K8s 클러스터 전체 노드 목록 (Ampere 있는지 확인) ==="
kubectl get nodes 2>&1 | grep -E "NAME|s211|ampere|Ampere" || echo "  Ampere 노드 없음"

echo ""
echo "=== 7. 문제 있는 node-exporter 파드 (Pending/Error/CrashLoop) ==="
kubectl -n monitoring get pods -l app=node-exporter --field-selector status.phase!=Running 2>&1 | head -15
