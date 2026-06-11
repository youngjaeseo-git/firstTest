#!/bin/bash
# 2026-06-11-3: Lab-3 Prometheus 진단 (38.100에서 실행)
# Lab-3 Prometheus API가 38.100에서 접근 가능하므로 원격 진단
# 실행: bash check/targetExecCmd/20260611-3.sh

LAB3="http://10.144.131.190:30003"

echo "=== A. Lab-3 Prometheus 설정 요약 ==="
# scrape_configs의 job_name만 추출 (전체 config는 너무 김)
timeout 10 curl -s "$LAB3/api/v1/status/config" 2>/dev/null | python3 -c "
import sys,json,yaml
try:
  d=json.load(sys.stdin)
  cfg=yaml.safe_load(d['data']['yaml'])
  sc=cfg.get('scrape_configs',[])
  print(f'jobs={len(sc)}')
  for s in sc:
    sd_types=[list(x.keys())[0] for x in s.get('kubernetes_sd_configs',[{'k8s':'?'}])] if 'kubernetes_sd_configs' in s else ['static' if 'static_configs' in s else '?']
    print(f'  {s[\"job_name\"]} | sd={sd_types}')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== B. Down 타겟 에러 원인 (샘플 3개) ==="
timeout 10 curl -s "$LAB3/api/v1/targets" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
ts=d.get('data',{}).get('activeTargets',[])
down=[t for t in ts if t.get('health')=='down']
seen_jobs=set()
count=0
for t in down:
  j=t.get('labels',{}).get('job','?')
  if j in seen_jobs: continue
  seen_jobs.add(j)
  count+=1
  if count>3: break
  url=t.get('scrapeUrl','?')
  err=t.get('lastError','?')[:120]
  print(f'{j} | url={url}')
  print(f'  err={err}')
" 2>/dev/null

echo ""
echo "=== C. Lab-1 Prometheus node-exporter 설정 (비교용) ==="
# Lab-1 설정에서 node-exporter job 설정만 추출
timeout 10 curl -s "http://10.100.175.248:8080/api/v1/status/config" 2>/dev/null | python3 -c "
import sys,json,yaml
try:
  d=json.load(sys.stdin)
  cfg=yaml.safe_load(d['data']['yaml'])
  sc=cfg.get('scrape_configs',[])
  ne=[s for s in sc if 'node' in s.get('job_name','').lower() or 'exporter' in s.get('job_name','').lower()]
  if ne:
    for s in ne:
      print(f'job: {s[\"job_name\"]}')
      if 'static_configs' in s:
        targets=[]
        for st in s['static_configs']:
          targets.extend(st.get('targets',[]))
        print(f'  type=static, targets={len(targets)}')
        # 샘플 2개만
        for t in targets[:2]:
          print(f'    {t}')
        if len(targets)>2:
          print(f'    ...+{len(targets)-2}개')
      elif 'kubernetes_sd_configs' in s:
        print(f'  type=k8s_sd')
      print(f'  interval={s.get(\"scrape_interval\",\"default\")}')
  else:
    # node-exporter가 없으면 전체 job 목록
    print('node-exporter job 없음. 전체 jobs:')
    for s in sc:
      print(f'  {s[\"job_name\"]}')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 끝 ==="
