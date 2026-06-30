#!/bin/bash
# 2026-06-12-2: NodePort 접근 확인 + Prometheus ConfigMap 수정
# ★★★ 131.100 (k8s-master-lab3)에서 실행 ★★★

echo "=== 1. NodePort 31672 접근 테스트 ==="
for IP in 10.144.131.101 10.144.131.111 10.144.131.190; do
  echo -n "$IP:31672 -> "
  CODE=$(timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://$IP:31672/metrics" 2>/dev/null)
  echo "${CODE:-FAIL}"
done

echo ""
echo "=== 2. 현재 ConfigMap 키 이름 ==="
kubectl get cm prometheus-server-conf -n monitoring -o jsonpath='{range .data}{@.key}{"\n"}{end}' 2>/dev/null || \
kubectl get cm prometheus-server-conf -n monitoring -o json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for k in d.get('data',{}).keys(): print(k)
" 2>/dev/null

echo ""
echo "=== 3. 전체 노드 IP 목록 (node-exporter 타겟용) ==="
kubectl get nodes -o wide --no-headers 2>/dev/null | awk '{print $6}' | sort

echo ""
echo "=== 끝 ==="
