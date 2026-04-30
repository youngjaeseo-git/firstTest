#!/bin/bash
# node-exporter / ipmi-exporter Pod 직접 확인
# K8s Pod로 실행 중이지만 Prometheus에 scrape 안 되는 상태 → Pod IP/Port에서 직접 메트릭 확인
# 사용법: bash check/20260430-exporter-check.sh > exporter-check-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
NS="monitoring"
CURL="curl -s --connect-timeout 5"

echo "=== node-exporter / ipmi-exporter 직접 확인 ==="
echo "Date: $(date '+%Y-%m-%d %H:%M')"
echo ""

# ─────────────────────────────────────────────
# A. node-exporter
# ─────────────────────────────────────────────
echo "=========================================="
echo "A. node-exporter Pod 확인"
echo "=========================================="

echo "--- A1. Pod 검색 (namespace=$NS) ---"
NE_PODS=$(kubectl get pods -n "$NS" -o wide --no-headers 2>/dev/null | grep -i node-exporter)
if [ -z "$NE_PODS" ]; then
  echo "  X node-exporter pod not found in $NS"
  NE_REACHABLE=false
else
  echo "$NE_PODS" | head -3
  NE_REACHABLE=true
fi
echo ""

if [ "$NE_REACHABLE" = true ]; then
  echo "--- A2. Pod IP & Port ---"
  # Get first running pod's IP and container port
  NE_POD=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | grep -i node-exporter | grep -i running | head -1 | awk '{print $1}')
  if [ -z "$NE_POD" ]; then
    NE_POD=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | grep -i node-exporter | head -1 | awk '{print $1}')
    echo "  WARN: no Running pod, using first match: $NE_POD"
  fi

  NE_IP=$(kubectl get pod -n "$NS" "$NE_POD" -o jsonpath='{.status.podIP}' 2>/dev/null)
  NE_PORT=$(kubectl get pod -n "$NS" "$NE_POD" -o jsonpath='{.spec.containers[0].ports[0].containerPort}' 2>/dev/null)
  # Fallback port
  NE_PORT=${NE_PORT:-9100}

  echo "  Pod: $NE_POD"
  echo "  IP:  $NE_IP"
  echo "  Port: $NE_PORT"
  echo ""

  echo "--- A3. /metrics 접속 테스트 ---"
  NE_URL="http://${NE_IP}:${NE_PORT}/metrics"
  NE_STATUS=$($CURL -o /dev/null -w "%{http_code}" "$NE_URL" 2>/dev/null)
  echo "  URL: $NE_URL"
  echo "  HTTP Status: $NE_STATUS"
  echo ""

  if [ "$NE_STATUS" = "200" ]; then
    NE_METRICS=$($CURL "$NE_URL" 2>/dev/null)

    echo "--- A4. 총 메트릭 패밀리 수 ---"
    NE_FAMILIES=$(echo "$NE_METRICS" | grep "^# TYPE " | wc -l)
    echo "  Metric families: $NE_FAMILIES"
    echo ""

    echo "--- A5. 핵심 메트릭 존재 여부 + 샘플 1줄 ---"
    for m in node_cpu_seconds_total node_memory_MemTotal_bytes node_disk_read_bytes_total node_filesystem_size_bytes node_network_receive_bytes_total node_hwmon_temp_celsius; do
      SAMPLE=$(echo "$NE_METRICS" | grep "^${m}" | head -1)
      if [ -n "$SAMPLE" ]; then
        # Truncate long lines for readability
        printf "  O %-40s %s\n" "$m" "$(echo "$SAMPLE" | cut -c1-120)"
      else
        printf "  X %-40s not found\n" "$m"
      fi
    done
    echo ""
  else
    echo "  SKIP: /metrics unreachable (status=$NE_STATUS)"
    echo ""
  fi
fi

# ─────────────────────────────────────────────
# B. ipmi-exporter
# ─────────────────────────────────────────────
echo "=========================================="
echo "B. ipmi-exporter Pod 확인"
echo "=========================================="

echo "--- B1. Pod 검색 (namespace=$NS) ---"
IPMI_PODS=$(kubectl get pods -n "$NS" -o wide --no-headers 2>/dev/null | grep -i ipmi-exporter)
if [ -z "$IPMI_PODS" ]; then
  echo "  X ipmi-exporter pod not found in $NS"
  IPMI_REACHABLE=false
else
  echo "$IPMI_PODS" | head -3
  IPMI_REACHABLE=true
fi
echo ""

if [ "$IPMI_REACHABLE" = true ]; then
  echo "--- B2. Pod IP & Port ---"
  IPMI_POD=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | grep -i ipmi-exporter | grep -i running | head -1 | awk '{print $1}')
  if [ -z "$IPMI_POD" ]; then
    IPMI_POD=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | grep -i ipmi-exporter | head -1 | awk '{print $1}')
    echo "  WARN: no Running pod, using first match: $IPMI_POD"
  fi

  IPMI_IP=$(kubectl get pod -n "$NS" "$IPMI_POD" -o jsonpath='{.status.podIP}' 2>/dev/null)
  IPMI_PORT=$(kubectl get pod -n "$NS" "$IPMI_POD" -o jsonpath='{.spec.containers[0].ports[0].containerPort}' 2>/dev/null)
  # Fallback port
  IPMI_PORT=${IPMI_PORT:-9290}

  echo "  Pod: $IPMI_POD"
  echo "  IP:  $IPMI_IP"
  echo "  Port: $IPMI_PORT"
  echo ""

  echo "--- B3. /metrics 접속 테스트 ---"
  IPMI_URL="http://${IPMI_IP}:${IPMI_PORT}/metrics"
  IPMI_STATUS=$($CURL -o /dev/null -w "%{http_code}" "$IPMI_URL" 2>/dev/null)
  echo "  URL: $IPMI_URL"
  echo "  HTTP Status: $IPMI_STATUS"
  echo ""

  if [ "$IPMI_STATUS" = "200" ]; then
    IPMI_METRICS=$($CURL "$IPMI_URL" 2>/dev/null)

    echo "--- B4. 총 메트릭 패밀리 수 ---"
    IPMI_FAMILIES=$(echo "$IPMI_METRICS" | grep "^# TYPE " | wc -l)
    echo "  Metric families: $IPMI_FAMILIES"
    echo ""

    echo "--- B5. 핵심 메트릭 존재 여부 + 샘플 1줄 ---"
    for m in ipmi_temperature_celsius ipmi_fan_speed_rpm ipmi_power_watts ipmi_sensor_value; do
      SAMPLE=$(echo "$IPMI_METRICS" | grep "^${m}" | head -1)
      if [ -n "$SAMPLE" ]; then
        printf "  O %-40s %s\n" "$m" "$(echo "$SAMPLE" | cut -c1-120)"
      else
        printf "  X %-40s not found\n" "$m"
      fi
    done
    echo ""
  else
    echo "  SKIP: /metrics unreachable (status=$IPMI_STATUS)"
    echo ""

    # ipmi-exporter often uses /ipmi?target= pattern instead of /metrics
    echo "--- B3b. 대안 엔드포인트 확인 (/ipmi) ---"
    IPMI_ALT_STATUS=$($CURL -o /dev/null -w "%{http_code}" "http://${IPMI_IP}:${IPMI_PORT}/" 2>/dev/null)
    echo "  Root endpoint status: $IPMI_ALT_STATUS"
    # Try to get the landing page which may list endpoints
    IPMI_ROOT=$($CURL "http://${IPMI_IP}:${IPMI_PORT}/" 2>/dev/null | grep -i "href" | head -3)
    if [ -n "$IPMI_ROOT" ]; then
      echo "  Available links:"
      echo "$IPMI_ROOT" | sed 's/^/    /'
    fi
    echo ""
  fi
fi

# ─────────────────────────────────────────────
# C. Prometheus scrape config 확인
# ─────────────────────────────────────────────
echo "=========================================="
echo "C. Prometheus scrape 설정 확인"
echo "=========================================="

echo "--- C1. node-exporter 관련 target ---"
$CURL "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  targets=d.get('data',{}).get('activeTargets',[])
  found=False
  for t in targets:
    job=t.get('labels',{}).get('job','')
    if 'node' in job.lower() and 'export' in job.lower():
      print(f'  O job={job} state={t.get(\"health\",\"?\")} target={t.get(\"scrapeUrl\",\"?\")}')
      found=True
  dropped=d.get('data',{}).get('droppedTargets',[])
  for t in dropped:
    job=t.get('discoveredLabels',{}).get('__meta_kubernetes_pod_label_app','')
    if 'node' in job.lower() and 'export' in job.lower():
      print(f'  D (dropped) label_app={job}')
      found=True
  if not found:
    print('  X no node-exporter target found in Prometheus')
except Exception as e:
  print(f'  ERR: {e}')
" 2>/dev/null
echo ""

echo "--- C2. ipmi-exporter 관련 target ---"
$CURL "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  targets=d.get('data',{}).get('activeTargets',[])
  found=False
  for t in targets:
    job=t.get('labels',{}).get('job','')
    if 'ipmi' in job.lower():
      print(f'  O job={job} state={t.get(\"health\",\"?\")} target={t.get(\"scrapeUrl\",\"?\")}')
      found=True
  dropped=d.get('data',{}).get('droppedTargets',[])
  for t in dropped:
    job=t.get('discoveredLabels',{}).get('__meta_kubernetes_pod_label_app','')
    if 'ipmi' in job.lower():
      print(f'  D (dropped) label_app={job}')
      found=True
  if not found:
    print('  X no ipmi-exporter target found in Prometheus')
except Exception as e:
  print(f'  ERR: {e}')
" 2>/dev/null
echo ""

# ─────────────────────────────────────────────
# D. Summary
# ─────────────────────────────────────────────
echo "=========================================="
echo "D. 요약 (Summary)"
echo "=========================================="

# node-exporter summary
if [ "$NE_REACHABLE" = true ] && [ "${NE_STATUS:-0}" = "200" ]; then
  echo "  node-exporter: REACHABLE (${NE_IP}:${NE_PORT}, ${NE_FAMILIES:-0} metric families)"
elif [ "$NE_REACHABLE" = true ]; then
  echo "  node-exporter: POD EXISTS but /metrics UNREACHABLE (status=${NE_STATUS:-?})"
else
  echo "  node-exporter: POD NOT FOUND"
fi

# ipmi-exporter summary
if [ "$IPMI_REACHABLE" = true ] && [ "${IPMI_STATUS:-0}" = "200" ]; then
  echo "  ipmi-exporter: REACHABLE (${IPMI_IP}:${IPMI_PORT}, ${IPMI_FAMILIES:-0} metric families)"
elif [ "$IPMI_REACHABLE" = true ]; then
  echo "  ipmi-exporter: POD EXISTS but /metrics UNREACHABLE (status=${IPMI_STATUS:-?})"
else
  echo "  ipmi-exporter: POD NOT FOUND"
fi

echo ""
echo "=== 완료 ==="
