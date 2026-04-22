#!/bin/bash
# machine_memory_bytes에서 s222hax14ae005의 정확한 instance 값 확인
# 사용법: bash check/20260422-exact-instance.sh
PROM="http://10.100.175.248:8080"
API="$PROM/api/v1/query"
HOST="${1:-s222hax14ae005}"

pq() {
  curl -s --get --data-urlencode "query=$1" "$API" 2>/dev/null
}

echo "=== machine_memory_bytes의 정확한 instance 값 ==="
pq "machine_memory_bytes{instance=~\".*${HOST}.*\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'결과 수: {len(r)}')
for x in r:
  print(f'  instance: [{x[\"metric\"].get(\"instance\",\"\")}]')
  print(f'  job: {x[\"metric\"].get(\"job\",\"\")}')
" 2>/dev/null

echo ""
echo "=== machine_cpu_cores의 정확한 instance 값 ==="
pq "machine_cpu_cores{instance=~\".*${HOST}.*\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'결과 수: {len(r)}')
for x in r:
  print(f'  instance: [{x[\"metric\"].get(\"instance\",\"\")}]')
  print(f'  job: {x[\"metric\"].get(\"job\",\"\")}')
" 2>/dev/null

echo ""
echo "=== container_cpu_usage의 정확한 instance 값 ==="
pq "container_cpu_usage_seconds_total{instance=~\".*${HOST}.*\",id=\"/\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'결과 수: {len(r)}')
for x in r:
  print(f'  instance: [{x[\"metric\"].get(\"instance\",\"\")}]')
  print(f'  job: {x[\"metric\"].get(\"job\",\"\")}')
" 2>/dev/null
