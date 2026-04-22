#!/bin/bash
# Register 라우트가 보내는 것과 동일한 쿼리를 직접 실행해서 검증
# 사용법: bash check/20260422-verify-register-query.sh s222hax14ae005
# 서버 호스트네임을 인자로 전달
PROM="http://10.100.175.248:8080"
API="$PROM/api/v1/query"
HOST="${1:-s222hax14ae005}"

pq() {
  curl -s --get --data-urlencode "query=$1" "$API" 2>/dev/null
}

echo "=== 대상: $HOST ==="

echo ""
echo "--- 1. memory 쿼리 (register와 동일) ---"
MEMQ="max(machine_memory_bytes{instance=~\"${HOST}(:.*)?\"})"
echo "query: $MEMQ"
pq "$MEMQ" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'status: {d.get(\"status\")}')
r=d.get('data',{}).get('result',[])
print(f'result count: {len(r)}')
if r:
  val=r[0].get('value',[None,None])[1]
  print(f'bytes: {val}')
  if val: print(f'GB: {round(float(val)/1024/1024/1024)}')
" 2>/dev/null

echo ""
echo "--- 2. cpu 쿼리 (register와 동일) ---"
CPUQ="max(machine_cpu_cores{instance=~\"${HOST}(:.*)?\"})"
echo "query: $CPUQ"
pq "$CPUQ" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'status: {d.get(\"status\")}')
r=d.get('data',{}).get('result',[])
print(f'result count: {len(r)}')
if r:
  val=r[0].get('value',[None,None])[1]
  print(f'cores: {val}')
" 2>/dev/null

echo ""
echo "--- 3. up 확인 ---"
pq "up{instance=\"${HOST}\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
for x in r: print(f'job={x[\"metric\"].get(\"job\")} value={x[\"value\"][1]}')
if not r: print('(매칭 없음)')
" 2>/dev/null

echo ""
echo "=== 완료 ==="
