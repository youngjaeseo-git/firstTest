#!/bin/bash
# s222hax14ae005 서버의 사용 가능 메트릭 + cadvisor 서버 비교
# 사용법: bash check/20260422-server-metrics.sh > server-metrics-result.txt 2>&1
PROM="http://10.100.175.248:8080"
Q="$PROM/api/v1/query?query="

echo "=== A. s222hax14ae005 메트릭 이름 목록 ==="
curl -s "${Q}{__name__=~\".+\",instance=~\".*s222hax14ae005.*\"}" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=sorted(set(r['metric']['__name__'] for r in d.get('data',{}).get('result',[])))
print(f'메트릭 수: {len(names)}')
for n in names: print(f'  {n}')
" 2>/dev/null

echo ""
echo "=== B. kubernetes-cadvisor UP 서버 1개 호스트네임 ==="
curl -s "${Q}up{job=\"kubernetes-cadvisor\",health=\"1\"}" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
ups=[x for x in r if x['value'][1]=='1']
if ups: print(ups[0]['metric']['instance'])
else:
  if r: print(r[0]['metric']['instance'])
  else: print('(없음)')
" 2>/dev/null

echo ""
echo "=== C. cadvisor 서버(위 결과)의 메트릭 이름 ==="
echo "(B의 결과 호스트네임을 아래 CHOST에 넣고 다시 실행하거나, 아래 자동 결과 확인)"
CHOST=$(curl -s "${Q}up{job=\"kubernetes-cadvisor\"}" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
ups=[x for x in r if x['value'][1]=='1']
if ups: print(ups[0]['metric']['instance'])
elif r: print(r[0]['metric']['instance'])
" 2>/dev/null)
echo "cadvisor 서버: $CHOST"
if [ -n "$CHOST" ]; then
curl -s "${Q}{__name__=~\".+\",instance=\"${CHOST}\"}" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=sorted(set(r['metric']['__name__'] for r in d.get('data',{}).get('result',[])))
print(f'메트릭 수: {len(names)}')
for n in names: print(f'  {n}')
" 2>/dev/null
fi

echo ""
echo "=== D. Package_Joules_Consumed에 s222hax14ae005 존재하는지 ==="
curl -s "${Q}Package_Joules_Consumed{instance=~\".*s222hax14ae005.*\"}" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print(f'결과 수: {len(r)}')
if r: print(json.dumps(r[0]['metric'],indent=2,ensure_ascii=False))
" 2>/dev/null

echo ""
echo "=== 완료 ==="
