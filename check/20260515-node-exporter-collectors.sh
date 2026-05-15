#!/bin/bash
# node-exporter Prometheus ConfigMap 진단 및 수정 가이드
# 실행: bash check/20260515-node-exporter-collectors.sh

PROM=http://10.100.175.248:8080

echo "=== 1. 현재 Prometheus ConfigMap의 node-exporter 설정 ==="
kubectl -n monitoring get configmap prometheus-server-conf -o jsonpath='{.data.prometheus\.yml}' 2>/dev/null | python3 -c "
import sys
config = sys.stdin.read()
lines = config.split('\n')
in_ne = False
for i, line in enumerate(lines):
    if 'node-exporter' in line and 'job_name' in line:
        in_ne = True
    if in_ne:
        print(line)
        if i > 0 and line.strip().startswith('- job_name') and 'node-exporter' not in line:
            break
        if in_ne and line.strip() == '' and i > 5:
            break
"

echo ""
echo "=== 2. Prometheus가 실제 스크래핑 중인 node-exporter 타겟 전체 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = [t for t in d.get('data',{}).get('activeTargets',[]) if t.get('labels',{}).get('job') == 'node-exporter']
print('  Total targets: ' + str(len(targets)))
for t in targets:
    inst = t.get('labels',{}).get('instance','')
    addr = t.get('discoveredLabels',{}).get('__address__','')
    health = t.get('health','')
    dur = t.get('lastScrapeDuration',0)
    err = t.get('lastError','')
    status = 'OK' if not err else err[:80]
    print('  ' + addr + ' -> instance=' + inst + ' health=' + health + ' ' + str(round(dur,3)) + 's  ' + status)
"

echo ""
echo "=== 3. node_ 메트릭이 실제 어떤 instance에서 오는지 ==="
curl -s "$PROM/api/v1/query?query=count by(instance)(node_load1)" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  node_load1: NO_DATA (no instance)')
for item in r:
    print('  node_load1 instance=' + item['metric'].get('instance','?') + ' count=' + item['value'][1])
"
curl -s "$PROM/api/v1/query?query=count by(instance)(node_memory_MemTotal_bytes)" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  node_memory_MemTotal_bytes: NO_DATA (no instance)')
for item in r:
    print('  node_memory_MemTotal instance=' + item['metric'].get('instance','?') + ' count=' + item['value'][1])
"

echo ""
echo "=== 4. 직접 확인: 각 서버에서 node-exporter 응답 ==="
for IP in 10.144.38.103 10.144.38.61 10.144.38.81; do
  CODE=$(curl -s --connect-timeout 3 -m 5 -o /dev/null -w "%{http_code}" "http://$IP:9100/metrics" 2>/dev/null)
  LOAD=$(curl -s --connect-timeout 3 -m 5 "http://$IP:9100/metrics" 2>/dev/null | grep "^node_load1 " | head -1)
  echo "  $IP:9100 HTTP=$CODE load=${LOAD:-NO_RESPONSE}"
done

echo ""
echo "=========================================="
echo "  수정 필요 시 아래 명령어 실행:"
echo "  kubectl -n monitoring edit configmap prometheus-server-conf"
echo ""
echo "  node-exporter job의 targets에 아래 IP가 있어야 함:"
echo "    - 10.144.38.103:9100  (SPR)"
echo "    - 10.144.38.61:9100   (GNR-AP)"
echo "    - 10.144.38.81:9100   (GNR-SP)"
echo "=========================================="
