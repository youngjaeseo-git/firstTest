#!/bin/bash
# 서버의 IP가 어디에 숨어있는지 Prometheus targets API에서 추적
# 사용법: bash check/20260428-find-ip-in-targets.sh > find-ip-targets-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "=== targets API에서 IP 추적 ($INST) ==="
echo ""

echo "--- 1. activeTargets에서 해당 서버 (scrapeUrl, globalUrl, labels) ---"
curl -s --connect-timeout 5 "$PROM/api/v1/targets" | python3 -c "
import json,sys,re
d=json.load(sys.stdin)
for t in d.get('data',{}).get('activeTargets',[]):
  inst=t.get('labels',{}).get('instance','')
  if '${INST}' not in inst: continue
  job=t.get('labels',{}).get('job','?')
  print(f'  job={job}')
  print(f'    scrapeUrl={t.get(\"scrapeUrl\",\"?\")}')
  print(f'    globalUrl={t.get(\"globalUrl\",\"?\")}')
  print(f'    health={t.get(\"health\",\"?\")}')
  # IP 패턴이 있는 라벨만 출력
  for k,v in sorted(t.get('labels',{}).items()):
    if re.search(r'\d+\.\d+\.\d+\.\d+', str(v)) or 'ip' in k.lower() or 'addr' in k.lower():
      print(f'    label: {k}={v}')
  # discoveredLabels 확인
  for k,v in sorted(t.get('discoveredLabels',{}).items()):
    if re.search(r'\d+\.\d+\.\d+\.\d+', str(v)) or 'address' in k.lower():
      print(f'    discovered: {k}={v}')
  print()
" 2>/dev/null

echo "--- 2. droppedTargets에서 해당 서버 ---"
curl -s --connect-timeout 5 "$PROM/api/v1/targets" | python3 -c "
import json,sys,re
d=json.load(sys.stdin)
found=False
for t in d.get('data',{}).get('droppedTargets',[]):
  dl=t.get('discoveredLabels',{})
  match=False
  for v in dl.values():
    if '${INST}' in str(v): match=True
  if not match: continue
  found=True
  for k,v in sorted(dl.items()):
    if re.search(r'\d+\.\d+\.\d+\.\d+', str(v)) or 'address' in k.lower() or 'host' in k.lower():
      print(f'  {k}={v}')
  print()
if not found: print('  X empty')
" 2>/dev/null

echo "=== 완료 ==="
