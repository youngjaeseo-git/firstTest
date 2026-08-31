#!/bin/bash
# 2026-06-01: node-exporter 메트릭의 실제 job 라벨 확인
# job="node-exporter" 타겟이 0개로 변경됨 → 실제 어떤 job으로 수집되는지 확인
PROM="http://10.144.38.100:30003"

echo "=== 1. node_uname_info의 job 라벨 분포 ==="
curl -s "$PROM/api/v1/query?query=node_uname_info" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
jobs = {}
for r in results:
    j = r['metric'].get('job','')
    jobs[j] = jobs.get(j, 0) + 1
for j, c in sorted(jobs.items()):
    print(f'{j}: {c}')
" 2>/dev/null

echo ""
echo "=== 2. node_cpu_seconds_total의 job 라벨 (샘플 1개) ==="
curl -s "$PROM/api/v1/query?query=node_cpu_seconds_total{mode=%22idle%22,cpu=%220%22}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
jobs = {}
for r in results:
    j = r['metric'].get('job','')
    inst = r['metric'].get('instance','')
    jobs[j] = jobs.get(j, 0) + 1
for j, c in sorted(jobs.items()):
    print(f'{j}: {c}개 instance')
if results:
    r = results[0]
    print(f'sample: job={r[\"metric\"].get(\"job\",\"\")}, instance={r[\"metric\"].get(\"instance\",\"\")}')
" 2>/dev/null

echo ""
echo "=== 3. up 메트릭 전체 job별 타겟 수 ==="
curl -s "$PROM/api/v1/query?query=up" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
jobs = {}
for r in results:
    j = r['metric'].get('job','')
    v = r['value'][1]
    key = f'{j} (up={v})'
    jobs[key] = jobs.get(key, 0) + 1
for j, c in sorted(jobs.items()):
    print(f'{j}: {c}')
" 2>/dev/null

echo ""
echo "=== 4. 10.80.103.* 대역 존재 여부 ==="
curl -s "$PROM/api/v1/query?query=up{instance=~%2210.80.103.*%22}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
print(f'10.80.103.* 타겟 수: {len(results)}')
for r in sorted(results, key=lambda x: x['metric'].get('instance','')):
    m = r['metric']
    print(f\"  {m.get('instance',''):25s} job={m.get('job',''):25s} up={r['value'][1]}\")
" 2>/dev/null

echo ""
echo "=== 5. ipmi_up 메트릭 샘플 (IPMI exporter 동작 확인) ==="
curl -s "$PROM/api/v1/query?query=ipmi_up" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
print(f'ipmi_up 타겟 수: {len(results)}')
up_count = sum(1 for r in results if r['value'][1] == '1')
down_count = len(results) - up_count
print(f'  up=1: {up_count}, up=0: {down_count}')
if results:
    r = results[0]
    m = r['metric']
    print(f'sample labels: job={m.get(\"job\",\"\")}, instance={m.get(\"instance\",\"\")}')
" 2>/dev/null
