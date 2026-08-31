#!/bin/bash
# 2026-06-12: Lab-3 node-exporter 네트워크 설정 확인
# ★★★ 131.100 (k8s-master-lab3)에서 실행 ★★★

echo "=== 1. node-exporter Pod 네트워크 설정 ==="
# hostNetwork 여부 + 포트 확인 (1개 pod만)
NE_POD=$(kubectl get pods -n monitoring --no-headers 2>/dev/null | grep node-exporter | head -1 | awk '{print $1}')
if [ -n "$NE_POD" ]; then
  echo "pod: $NE_POD"
  kubectl get pod "$NE_POD" -n monitoring -o jsonpath='{.spec.hostNetwork}' 2>/dev/null
  echo " (hostNetwork)"
  echo -n "podIP: "
  kubectl get pod "$NE_POD" -n monitoring -o jsonpath='{.status.podIP}' 2>/dev/null
  echo ""
  echo -n "hostIP: "
  kubectl get pod "$NE_POD" -n monitoring -o jsonpath='{.status.hostIP}' 2>/dev/null
  echo ""
  echo -n "port: "
  kubectl get pod "$NE_POD" -n monitoring -o jsonpath='{.spec.containers[0].ports[0].containerPort}' 2>/dev/null
  echo ""
else
  echo "pod 못 찾음"
fi

echo ""
echo "=== 2. node-exporter Service 존재 여부 ==="
kubectl get svc -n monitoring 2>/dev/null | grep -i node-exp || echo "Service 없음"

echo ""
echo "=== 3. node-exporter Pod IP → 9100 접근 ==="
if [ -n "$NE_POD" ]; then
  POD_IP=$(kubectl get pod "$NE_POD" -n monitoring -o jsonpath='{.status.podIP}' 2>/dev/null)
  echo -n "$POD_IP:9100 -> "
  timeout 2 curl -s -o /dev/null -w "%{http_code}" "http://$POD_IP:9100/metrics" 2>/dev/null || echo "FAIL"
fi

echo ""
echo "=== 4. Prometheus ConfigMap 내용 (job_name만) ==="
kubectl get cm prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import sys,json,yaml
try:
  d=json.load(sys.stdin)
  for k,v in d.items():
    cfg=yaml.safe_load(v)
    if 'scrape_configs' in cfg:
      for s in cfg['scrape_configs']:
        print(s.get('job_name','?'))
except: print('parse-err')
" 2>/dev/null || echo "추출 실패"

echo ""
echo "=== 끝 ==="
