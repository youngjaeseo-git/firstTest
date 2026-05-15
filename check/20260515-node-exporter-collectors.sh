#!/bin/bash
# node-exporter 메트릭 누락 정밀 진단
# 실행: bash check/20260515-node-exporter-collectors.sh

PROM=http://10.100.175.248:8080

echo "=== 1. Prometheus가 실제 사용 중인 node-exporter config ==="
echo "  (ConfigMap이 아닌 Prometheus API에서 직접 확인)"
curl -s "$PROM/api/v1/status/config" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
config = d.get('data',{}).get('yaml','')
lines = config.split('\n')
in_ne = False
printed = 0
for line in lines:
    if 'node-exporter' in line and 'job_name' in line:
        in_ne = True
    if in_ne:
        print('  ' + line)
        printed += 1
        if printed > 1 and line.strip().startswith('- job_name'):
            break
        if printed > 40:
            print('  ... (truncated)')
            break
if not in_ne:
    print('  node-exporter job NOT FOUND in running config!')
"

echo ""
echo "=== 2. 모든 node-exporter 타겟 (address + instance + health) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = [t for t in d.get('data',{}).get('activeTargets',[]) if t.get('labels',{}).get('job') == 'node-exporter']
print('  Total node-exporter targets: ' + str(len(targets)))
for t in sorted(targets, key=lambda x: x.get('discoveredLabels',{}).get('__address__','')):
    addr = t.get('discoveredLabels',{}).get('__address__','?')
    inst = t.get('labels',{}).get('instance','?')
    health = t.get('health','?')
    dur = t.get('lastScrapeDuration',0)
    err = t.get('lastError','')
    mismatch = ' *** MISMATCH' if addr != inst else ''
    print('  __address__=' + addr + ' instance=' + inst + ' health=' + health + ' scrape=' + str(round(dur,3)) + 's' + mismatch)
    if err:
        print('    error: ' + err[:120])
"

echo ""
echo "=== 3. node_ 메트릭이 존재하는 instance 라벨 값 ==="
curl -s "$PROM/api/v1/query?query=count by(instance, job)(node_load1)" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  node_load1 -> NO DATA anywhere')
for item in r:
    print('  node_load1 -> instance=' + item['metric'].get('instance','?') + ' job=' + item['metric'].get('job','?'))
"
curl -s "$PROM/api/v1/query?query=count by(instance, job)(node_filesystem_size_bytes)" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  node_filesystem_size_bytes -> NO DATA anywhere')
for item in r:
    print('  node_filesystem_size_bytes -> instance=' + item['metric'].get('instance','?') + ' job=' + item['metric'].get('job','?'))
"

echo ""
echo "=== 4. Prometheus config reload 시각 ==="
curl -s "$PROM/api/v1/status/runtimeinfo" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
info = d.get('data',{})
print('  lastConfigReload: ' + str(info.get('lastConfigTime', 'unknown')))
print('  reloadConfigSuccess: ' + str(info.get('reloadConfigSuccess', 'unknown')))
" 2>/dev/null || echo "  (runtimeinfo API not available)"

echo ""
echo "=== 5. ConfigMap vs Running config 비교 ==="
echo "  ConfigMap node-exporter targets:"
kubectl -n monitoring get configmap prometheus-server-conf -o jsonpath='{.data.prometheus\.yml}' 2>/dev/null | grep -A 30 "node-exporter" | grep -E "^\s+- \d" | head -10
echo ""
echo "  Running config node-exporter targets (from API):"
curl -s "$PROM/api/v1/status/config" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
config = d.get('data',{}).get('yaml','')
lines = config.split('\n')
in_ne = False
in_targets = False
for line in lines:
    if 'node-exporter' in line and 'job_name' in line:
        in_ne = True
    if in_ne and 'targets' in line:
        in_targets = True
        continue
    if in_ne and in_targets:
        stripped = line.strip()
        if stripped.startswith('- ') and ':' in stripped and '9100' in stripped:
            print('  ' + stripped)
        elif stripped.startswith('- job_name'):
            break
        elif not stripped.startswith('-') and not stripped.startswith('#') and stripped != '':
            break
"

echo ""
echo "=== 6. Prometheus pod 상태 및 재시작 시각 ==="
kubectl -n monitoring get pods -l app=prometheus-server -o wide 2>/dev/null || \
kubectl -n monitoring get pods | grep -i prometheus 2>/dev/null
