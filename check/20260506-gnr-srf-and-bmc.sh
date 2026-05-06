#!/bin/bash
# GNR/SRF 서버 정보 및 BMC IP 탐지 가능 여부 확인
# 실행: bash check/20260506-gnr-srf-and-bmc.sh > gnr-srf-bmc-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"

echo "====================================================="
echo " 1. AE-SMC_GNR*_PCM job 인스턴스 목록 및 라벨"
echo "====================================================="
curl -s --connect-timeout 5 --get \
  --data-urlencode 'query=up{job=~"AE-SMC_GNR.*"}' \
  "$PROM/api/v1/query" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  m = r['metric']
  print(f\"job={m.get('job','?')} instance={m.get('instance','?')} up={r['value'][1]}\")
" 2>/dev/null

echo ""
echo "====================================================="
echo " 2. Targets API — GNR 서버 discoveredLabels (BMC IP 여부 포함)"
echo "====================================================="
curl -s --connect-timeout 10 "$PROM/api/v1/targets" | python3 -c "
import json, sys, re
d = json.load(sys.stdin)
found = 0
for t in d.get('data',{}).get('activeTargets',[]):
  job = t.get('labels',{}).get('job','')
  if 'GNR' not in job and 'SRF' not in job: continue
  inst = t.get('labels',{}).get('instance','?')
  health = t.get('health','?')
  found += 1
  print(f'[{job}] {inst} ({health})')
  # 모든 라벨 출력 (IP, BMC, addr 관련)
  for k, v in sorted(t.get('labels',{}).items()):
    print(f'  label: {k} = {v}')
  for k, v in sorted(t.get('discoveredLabels',{}).items()):
    print(f'  discovered: {k} = {v}')
  print()
  if found >= 3: break  # 3개만 샘플
if found == 0: print('X GNR/SRF job not found in activeTargets')
" 2>/dev/null

echo ""
echo "====================================================="
echo " 3. server-info job 라벨 샘플 (BMC IP, HW 정보 포함 여부)"
echo "====================================================="
curl -s --connect-timeout 5 "$PROM/api/v1/targets" | python3 -c "
import json, sys
d = json.load(sys.stdin)
found = 0
for t in d.get('data',{}).get('activeTargets',[]) + d.get('data',{}).get('droppedTargets',[]):
  job = t.get('labels',{}).get('job','') or t.get('discoveredLabels',{}).get('job','')
  if job != 'server-info': continue
  found += 1
  if found > 2: continue  # 2개만 샘플
  inst = t.get('labels',{}).get('instance','?')
  health = t.get('health','dropped')
  print(f'instance={inst} ({health})')
  for k, v in sorted({**t.get('labels',{}), **t.get('discoveredLabels',{})}.items()):
    print(f'  {k} = {v}')
  print()
print(f'Total server-info targets: {found}')
" 2>/dev/null

echo ""
echo "====================================================="
echo " 4. PCM job 라벨에 BMC/IP 정보 있는지 확인"
echo "====================================================="
curl -s --connect-timeout 5 --get \
  --data-urlencode 'query=Package_Joules_Consumed' \
  "$PROM/api/v1/query" | python3 -c "
import json, sys
d = json.load(sys.stdin)
results = d.get('data',{}).get('result',[])
print(f'Total Package_Joules_Consumed series: {len(results)}')
# job별로 groupby
jobs = {}
for r in results:
  j = r['metric'].get('job','?')
  if j not in jobs: jobs[j] = []
  jobs[j].append(r['metric'])
for j, mlist in sorted(jobs.items()):
  print(f'  job={j} count={len(mlist)}')
  # 첫번째 샘플의 모든 라벨
  m = mlist[0]
  for k, v in sorted(m.items()):
    print(f'    {k} = {v}')
  print()
" 2>/dev/null

echo ""
echo "====================================================="
echo " 5. SRF 서버 중 kube_node_info 없는 서버 확인"
echo "    (AE-SMC_GNR*_PCM 인스턴스 vs cadvisor 인스턴스 교집합)"
echo "====================================================="
curl -s --connect-timeout 5 --get \
  --data-urlencode 'query=up{job="kubernetes-cadvisor"}' \
  "$PROM/api/v1/query" | python3 -c "
import json, sys
d = json.load(sys.stdin)
instances = sorted(set(r['metric'].get('instance','') for r in d.get('data',{}).get('result',[])))
print(f'kubernetes-cadvisor instances ({len(instances)}):')
for i in instances[:10]: print(f'  {i}')
if len(instances) > 10: print(f'  ... and {len(instances)-10} more')
" 2>/dev/null

echo ""
echo "====================================================="
echo " 6. kube_node_labels — 노드 라벨에 BMC/IP 힌트 있는지"
echo "====================================================="
curl -s --connect-timeout 5 --get \
  --data-urlencode 'query=kube_node_labels' \
  "$PROM/api/v1/query" | python3 -c "
import json, sys
d = json.load(sys.stdin)
results = d.get('data',{}).get('result',[])
print(f'kube_node_labels series: {len(results)}')
if results:
  # 첫번째 샘플의 모든 라벨 키 출력 (값 제외, 패턴만)
  m = results[0]['metric']
  print('Sample label keys:')
  for k in sorted(m.keys()):
    if 'ip' in k.lower() or 'bmc' in k.lower() or 'addr' in k.lower() or 'host' in k.lower() or 'mac' in k.lower():
      print(f'  KEY={k} VALUE={m[k]}')
    else:
      print(f'  KEY={k}')
" 2>/dev/null

echo ""
echo "====================================================="
echo " 완료"
echo "====================================================="
