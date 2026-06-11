#!/bin/bash
# 2026-06-11-5: Lab-3 클러스터 진단
# ★★★ 131.100 (k8s-master-lab3)에서 실행 ★★★
# 실행: bash 20260611-5.sh (파일을 131.100에 복사하거나 직접 입력)

echo "=== 1. node-exporter DaemonSet ==="
kubectl get ds -n monitoring 2>/dev/null | head -2 || echo "kubectl 불가"

echo ""
echo "=== 2. node-exporter Pod 상태 ==="
# ready/not-ready 개수만
kubectl get pods -n monitoring -l app=node-exporter --no-headers 2>/dev/null | awk '
  {split($2,a,"/"); if(a[1]==a[2]) r++; else nr++}
  END{print "running="r+0, "not-ready="nr+0}
' || echo "없음"

echo ""
echo "=== 3. Prometheus ConfigMap 이름 ==="
kubectl get cm -n monitoring 2>/dev/null | grep -i prom || echo "없음"

echo ""
echo "=== 4. node-exporter 로컬 접근 테스트 ==="
# 131.190(자기자신) → 131.101(워커) 9100 접근
echo -n "localhost:9100 -> "
timeout 2 curl -s -o /dev/null -w "%{http_code}" "http://localhost:9100/metrics" 2>/dev/null || echo "TIMEOUT"
echo ""
echo -n "131.101:9100 -> "
timeout 2 curl -s -o /dev/null -w "%{http_code}" "http://10.144.131.101:9100/metrics" 2>/dev/null || echo "TIMEOUT"
echo ""
echo -n "131.111:9100 -> "
timeout 2 curl -s -o /dev/null -w "%{http_code}" "http://10.144.131.111:9100/metrics" 2>/dev/null || echo "TIMEOUT"

echo ""
echo "=== 끝 ==="
