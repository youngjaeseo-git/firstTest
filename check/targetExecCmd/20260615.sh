#!/bin/bash
# Lab-3 node-exporter 롤아웃 정체 정밀 진단 (131.100에서 실행) - 읽기전용

echo "=== 1. 실제 Pod 라벨 (DaemonSet selector와 비교) ==="
kubectl get ds node-exporter -n monitoring -o jsonpath='selector={.spec.selector.matchLabels}{"\n"}'
POD=$(kubectl get pods -n monitoring -o name 2>&1 | grep node-exporter | head -1)
[ -n "$POD" ] && kubectl get "$POD" -n monitoring -o jsonpath='podlabels={.metadata.labels}{"\n"}'

echo ""
echo "=== 2. 롤아웃 예산 현황 (numberUnavailable이 maxUnavailable 이상이면 정체) ==="
kubectl get ds node-exporter -n monitoring -o jsonpath='maxUnavailable={.spec.updateStrategy.rollingUpdate.maxUnavailable} desired={.status.desiredNumberScheduled} available={.status.numberAvailable} unavailable={.status.numberUnavailable} uptodate={.status.updatedNumberScheduled}{"\n"}'

echo ""
echo "=== 3. NotReady 노드 (롤아웃 막는 꺼진 서버) ==="
kubectl get nodes --no-headers 2>&1 | awk '$2!="Ready"{print $1, $2}'

echo ""
echo "=== 4. 살아있는 노드에 있는 node-exporter Pod (수동 교체 후보) ==="
# Running 상태 + 노드가 Ready인 Pod만. NODE_IP가 172.x면 구버전(hostNetwork 미적용)
kubectl get pods -n monitoring -o wide 2>&1 | grep node-exporter | grep Running | awk '{print $1, $6, $7}' | head -20
