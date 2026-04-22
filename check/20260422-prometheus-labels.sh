#!/bin/bash
# Prometheus 데이터 구조 확인 스크립트
# 사용법: bash check-prometheus.sh > prometheus-check-result.txt 2>&1
# 결과 파일을 통째로 전달해주세요.

PROM="http://10.100.175.248:8080"

echo "============================================"
echo "1. kubernetes-nodes job 타겟 라벨 (1개 샘플)"
echo "============================================"
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data.get('data',{}).get('activeTargets',[]):
    if t.get('labels',{}).get('job') == 'kubernetes-nodes':
        print(json.dumps(t['labels'], indent=2))
        break
" 2>/dev/null || echo "(python3 없음, 원본 출력)"

echo ""
echo "============================================"
echo "2. server-info job 타겟 라벨 (1개 샘플)"
echo "============================================"
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data.get('data',{}).get('activeTargets',[]):
    if t.get('labels',{}).get('job') == 'server-info':
        print(json.dumps(t['labels'], indent=2))
        break
" 2>/dev/null || echo "(python3 없음)"

echo ""
echo "============================================"
echo "3. machine_memory_bytes 라벨 구조 (1개 샘플)"
echo "============================================"
curl -s "$PROM/api/v1/query?query=machine_memory_bytes" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
if results:
    print(json.dumps(results[0]['metric'], indent=2))
    print('value:', results[0].get('value'))
else:
    print('(결과 없음)')
" 2>/dev/null || echo "(python3 없음)"

echo ""
echo "============================================"
echo "4. s222hax14ae005 관련 메트릭 전체 조회"
echo "============================================"
curl -s "$PROM/api/v1/query?query=up%7Binstance%3D~%22.*s222hax14ae005.*%22%7D" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
print(f'매칭된 시리즈 수: {len(results)}')
for r in results:
    print(json.dumps(r['metric'], indent=2))
" 2>/dev/null || echo "(python3 없음)"

echo ""
echo "============================================"
echo "5. container_cpu_usage_seconds_total 라벨 (1개 샘플)"
echo "============================================"
curl -s "$PROM/api/v1/query?query=container_cpu_usage_seconds_total%7Bid%3D%22%2F%22%7D" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
if results:
    print(json.dumps(results[0]['metric'], indent=2))
else:
    print('(결과 없음)')
" 2>/dev/null || echo "(python3 없음)"

echo ""
echo "============================================"
echo "6. 전체 job 목록과 타겟 수"
echo "============================================"
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import sys, json
from collections import Counter
data = json.load(sys.stdin)
jobs = Counter()
for t in data.get('data',{}).get('activeTargets',[]):
    j = t.get('labels',{}).get('job','unknown')
    h = t.get('health','unknown')
    jobs[f'{j} ({h})'] += 1
for k, v in sorted(jobs.items()):
    print(f'  {k}: {v}')
" 2>/dev/null || echo "(python3 없음)"

echo ""
echo "============================================"
echo "7. Package_Joules_Consumed 라벨 (1개 샘플 - 전력)"
echo "============================================"
curl -s "$PROM/api/v1/query?query=Package_Joules_Consumed" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data',{}).get('result',[])
if results:
    print(json.dumps(results[0]['metric'], indent=2))
else:
    print('(결과 없음)')
" 2>/dev/null || echo "(python3 없음)"

echo ""
echo "============================================"
echo "완료. 이 파일 전체를 전달해주세요."
echo "============================================"
