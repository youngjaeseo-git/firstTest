#!/bin/bash
# s222hax14ae005 서버의 사용 가능 메트릭 + cadvisor 서버 비교
# 사용법: bash check/20260422-server-metrics.sh > server-metrics-result.txt 2>&1
PROM="http://10.100.175.248:8080"
API="$PROM/api/v1/query"

pq() {
  curl -s --get --data-urlencode "query=$1" "$API" 2>/dev/null
}

echo "=== A. s222hax14ae005 메트릭 이름 목록 ==="
pq '{__name__=~".+",instance=~".*s222hax14ae005.*"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=sorted(set(r['metric']['__name__'] for r in d.get('data',{}).get('result',[])))
print(f'메트릭 수: {len(names)}')
for n in names: print(f'  {n}')
" 2>/dev/null

echo ""
echo "=== B. kubernetes-cadvisor UP 서버 1개 호스트네임 ==="
pq 'up{job="kubernetes-cadvisor"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
ups=[x for x in r if x['value'][1]=='1']
if ups: print(ups[0]['metric']['instance'])
elif r: print(r[0]['metric']['instance'])
else: print('(없음)')
" 2>/dev/null

echo ""
echo "=== C. cadvisor UP 서버의 메트릭 이름 ==="
CHOST=$(pq 'up{job="kubernetes-cadvisor"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
ups=[x for x in r if x['value'][1]=='1']
if ups: print(ups[0]['metric']['instance'])
elif r: print(r[0]['metric']['instance'])
" 2>/dev/null)
echo "cadvisor 서버: $CHOST"
if [ -n "$CHOST" ]; then
pq "{__name__=~\".+\",instance=\"${CHOST}\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=sorted(set(r['metric']['__name__'] for r in d.get('data',{}).get('result',[])))
print(f'메트릭 수: {len(names)}')
for n in names: print(f'  {n}')
" 2>/dev/null
fi

echo ""
echo "=== D. s222hax14ae005의 Package_Joules_Consumed ==="
pq 'Package_Joules_Consumed{instance=~".*s222hax14ae005.*"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'결과 수: {len(r)}')
if r: print(json.dumps(r[0]['metric'],indent=2,ensure_ascii=False))
" 2>/dev/null

echo ""
echo "=== E. s222hax14ae005의 전체 job 확인 ==="
pq 'up{instance="s222hax14ae005"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'매칭 수: {len(r)}')
for x in r: print(f'  job={x[\"metric\"].get(\"job\",\"?\")} value={x[\"value\"][1]}')
" 2>/dev/null

echo ""
echo "=== 완료 ==="
