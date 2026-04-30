#!/bin/bash
# node-exporter / ipmi-exporter 동작 불가 원인 진단
# 사용법: bash check/20260430-exporter-diagnose.sh > exporter-diagnose-result.txt 2>&1

NS="monitoring"
PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"

echo "=== Exporter 진단 스크립트 ==="
echo "Date: $(date '+%Y-%m-%d %H:%M')"
echo ""

# ─── 1. Pod 로그 (최근 20줄) ───
echo "=========================================="
echo "1. Pod 로그 (최근 에러/경고)"
echo "=========================================="

echo "--- 1a. node-exporter 로그 ---"
NE_POD=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | grep node-exporter | grep Running | head -1 | awk '{print $1}')
if [ -n "$NE_POD" ]; then
  echo "  Pod: $NE_POD"
  kubectl logs -n "$NS" "$NE_POD" --tail=15 2>&1 | sed 's/^/  /'
else
  echo "  X Running pod not found"
fi
echo ""

echo "--- 1b. ipmi-exporter 로그 ---"
IPMI_POD=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | grep ipmi-exporter | grep Running | head -1 | awk '{print $1}')
if [ -n "$IPMI_POD" ]; then
  echo "  Pod: $IPMI_POD"
  kubectl logs -n "$NS" "$IPMI_POD" --tail=15 2>&1 | sed 's/^/  /'
else
  echo "  X Running pod not found"
fi
echo ""

# ─── 2. Pod Spec (hostNetwork, ports, args) ───
echo "=========================================="
echo "2. Pod Spec 핵심 설정"
echo "=========================================="

echo "--- 2a. node-exporter spec ---"
if [ -n "$NE_POD" ]; then
  kubectl get pod -n "$NS" "$NE_POD" -o jsonpath='
  hostNetwork: {.spec.hostNetwork}
  hostPID: {.spec.hostPID}
  nodeName: {.spec.nodeName}
  containers[0].name: {.spec.containers[0].name}
  containers[0].image: {.spec.containers[0].image}
  containers[0].ports: {.spec.containers[0].ports}
  containers[0].args: {.spec.containers[0].args}
  volumeMounts: {.spec.containers[0].volumeMounts[*].mountPath}
' 2>/dev/null
  echo ""
fi
echo ""

echo "--- 2b. ipmi-exporter spec ---"
if [ -n "$IPMI_POD" ]; then
  kubectl get pod -n "$NS" "$IPMI_POD" -o jsonpath='
  hostNetwork: {.spec.hostNetwork}
  hostPID: {.spec.hostPID}
  nodeName: {.spec.nodeName}
  containers[0].name: {.spec.containers[0].name}
  containers[0].image: {.spec.containers[0].image}
  containers[0].ports: {.spec.containers[0].ports}
  containers[0].args: {.spec.containers[0].args}
' 2>/dev/null
  echo ""
fi
echo ""

# ─── 2c. DaemonSet 확인 ───
echo "--- 2c. DaemonSet 설정 ---"
echo "  node-exporter DaemonSet:"
kubectl get daemonset -n "$NS" 2>/dev/null | grep -i node-exporter | sed 's/^/    /'
echo "  ipmi-exporter DaemonSet:"
kubectl get daemonset -n "$NS" 2>/dev/null | grep -i ipmi-exporter | sed 's/^/    /'
echo ""

# ─── 3. Prometheus ConfigMap ───
echo "=========================================="
echo "3. Prometheus ConfigMap (scrape_configs)"
echo "=========================================="

echo "--- 3a. ConfigMap 이름 찾기 ---"
PROM_CM=$(kubectl get configmap -n "$NS" --no-headers 2>/dev/null | grep -i prom | awk '{print $1}')
if [ -z "$PROM_CM" ]; then
  PROM_CM=$(kubectl get configmap -n "$NS" --no-headers 2>/dev/null | awk '{print $1}')
fi
echo "  ConfigMaps in $NS:"
kubectl get configmap -n "$NS" --no-headers 2>/dev/null | awk '{print "    "$1}' | head -10
echo ""

echo "--- 3b. Prometheus 설정에서 node-exporter / ipmi 관련 부분 ---"
for cm in $PROM_CM; do
  CONTENT=$(kubectl get configmap -n "$NS" "$cm" -o jsonpath='{.data}' 2>/dev/null)
  if echo "$CONTENT" | grep -qi "scrape_config\|job_name"; then
    echo "  ConfigMap: $cm"
    # Extract node-exporter related job
    kubectl get configmap -n "$NS" "$cm" -o yaml 2>/dev/null | grep -A 15 -i "node.exporter\|node_exporter" | head -20 | sed 's/^/    /'
    echo "  ---"
    # Extract ipmi related job
    kubectl get configmap -n "$NS" "$cm" -o yaml 2>/dev/null | grep -A 15 -i "ipmi" | head -20 | sed 's/^/    /'
    echo ""
  fi
done

# ─── 4. ipmi-exporter dropped 원인 ───
echo "=========================================="
echo "4. ipmi-exporter dropped 원인"
echo "=========================================="

echo "--- 4a. dropped target 상세 (1개 샘플) ---"
curl -s --connect-timeout 5 "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  dropped=d.get('data',{}).get('droppedTargets',[])
  found=0
  for t in dropped:
    dl=t.get('discoveredLabels',{})
    app=dl.get('__meta_kubernetes_pod_label_app','')
    if 'ipmi' in app.lower():
      if found==0:
        print('  discoveredLabels:')
        for k in sorted(dl.keys()):
          print(f'    {k} = {dl[k]}')
      found+=1
  print(f'  total dropped ipmi targets: {found}')
except Exception as e:
  print(f'  ERR: {e}')
" 2>/dev/null
echo ""

echo "--- 4b. active target에서 relabel 힌트 ---"
curl -s --connect-timeout 5 "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  active=d.get('data',{}).get('activeTargets',[])
  pools=set()
  for t in active:
    pools.add(t.get('scrapePool',''))
  print('  Active scrape pools:')
  for p in sorted(pools):
    count=sum(1 for t in active if t.get('scrapePool','')==p)
    print(f'    {p} ({count} targets)')
except Exception as e:
  print(f'  ERR: {e}')
" 2>/dev/null
echo ""

# ─── 5. Pod 내부 포트 리스닝 확인 ───
echo "=========================================="
echo "5. Pod 내부 포트 리스닝 확인"
echo "=========================================="

echo "--- 5a. node-exporter: netstat/ss in pod ---"
if [ -n "$NE_POD" ]; then
  kubectl exec -n "$NS" "$NE_POD" -- sh -c "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo 'no ss/netstat'" 2>&1 | head -10 | sed 's/^/  /'
fi
echo ""

echo "--- 5b. ipmi-exporter: netstat/ss in pod ---"
if [ -n "$IPMI_POD" ]; then
  kubectl exec -n "$NS" "$IPMI_POD" -- sh -c "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo 'no ss/netstat'" 2>&1 | head -10 | sed 's/^/  /'
fi
echo ""

echo "=== 진단 완료 ==="
