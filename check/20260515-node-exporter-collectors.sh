#!/bin/bash
# node-exporter 메트릭 누락 최종 진단
# 실행: bash check/20260515-node-exporter-collectors.sh

PROM=http://10.100.175.248:8080

echo "=== 1. node_load1 데이터가 있는 instance (필터 없이) ==="
curl -s "$PROM/api/v1/query" --data-urlencode "query=node_load1" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  node_load1: NO DATA (none)')
for item in r:
    inst = item['metric'].get('instance','?')
    job = item['metric'].get('job','?')
    val = item['value'][1]
    print('  instance=' + inst + ' job=' + job + ' value=' + val)
"

echo ""
echo "=== 2. node_filesystem_size_bytes instance 확인 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=count by(instance)(node_filesystem_size_bytes)' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  node_filesystem: NO DATA')
for item in r:
    inst = item['metric'].get('instance','?')
    print('  instance=' + inst + ' series=' + item['value'][1])
"

echo ""
echo "=== 3. node-exporter 타겟 상세 (전체) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = [t for t in d.get('data',{}).get('activeTargets',[]) if t.get('labels',{}).get('job') == 'node-exporter']
print('  Total: ' + str(len(targets)))
for t in sorted(targets, key=lambda x: x.get('labels',{}).get('instance','')):
    inst = t.get('labels',{}).get('instance','?')
    health = t.get('health','?')
    dur = t.get('lastScrapeDuration',0)
    err = t.get('lastError','')
    line = '  ' + inst + ' ' + health + ' ' + str(round(dur,3)) + 's'
    if err:
        line += ' ERR:' + err[:60]
    print(line)
"

echo ""
echo "=== 4. 10.144.38.103 관련 메트릭 유무 ==="
echo "  instance=10.144.38.103:9100 :"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{instance="10.144.38.103:9100"}' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print('    up=' + (r[0]['value'][1] if r else 'NOT_FOUND'))
"
echo "  instance=10.144.38.103 (no port):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{instance=~"10.144.38.103.*"}' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('    NOT_FOUND')
for item in r:
    print('    instance=' + item['metric'].get('instance','?') + ' job=' + item['metric'].get('job','?') + ' up=' + item['value'][1])
"

echo ""
echo "=== 5. Prometheus running config (node-exporter job only) ==="
curl -s "$PROM/api/v1/status/config" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
config = d.get('data',{}).get('yaml','')
lines = config.split('\n')
in_ne = False
count = 0
for line in lines:
    if 'node-exporter' in line and 'job_name' in line:
        in_ne = True
    if in_ne:
        print('  ' + line)
        count += 1
        if count > 2 and line.strip().startswith('- job_name'):
            break
        if count > 30:
            break
if not in_ne:
    print('  NOT FOUND in running config')
"
