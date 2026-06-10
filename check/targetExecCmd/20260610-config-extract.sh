#!/bin/bash
# 2026-06-10: Prometheus ConfigMap에서 필요한 정보만 추출
# Lab-1(10.144.38.100)에서 실행
# 출력 최소화 — 타이핑 부담 줄임
# 실행: bash check/targetExecCmd/20260610-config-extract.sh

echo "=== 1. ConfigMap 목록 (monitoring) ==="
kubectl get configmap -n monitoring 2>/dev/null | grep -i prom

echo ""
echo "=== 2. Lab-3 관련 타겟 추출 (131 대역 + Lab-3 hostname) ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import json,sys,yaml
try:
  data=json.loads(sys.stdin.read())
  for fname,content in data.items():
    cfg=yaml.safe_load(content)
    if not isinstance(cfg, dict) or 'scrape_configs' not in cfg: continue
    print(f'--- file: {fname} ---')
    for j in cfg['scrape_configs']:
      name=j.get('job_name','?')
      path=j.get('metrics_path','/metrics')
      honor=j.get('honor_labels',False)
      # Lab-3 관련 체크
      raw=str(j)
      has131='10.144.131' in raw
      has_lab3_host=any(h in raw for h in ['s222hax14ae','s222hx14ae','g222bx14ae','s121x13ae'])
      has_fed=(path=='/federate')
      if has131 or has_lab3_host or has_fed:
        targets=[]
        for sc in j.get('static_configs',[]):
          targets.extend(sc.get('targets',[]))
        tcount=len(targets)
        sample=targets[:3] if targets else ['k8s_sd']
        print(f'  job={name} path={path} honor={honor} targets={tcount} sample={sample}')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 3. federation 키워드 검색 ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import json,sys
try:
  data=json.loads(sys.stdin.read())
  for fname,content in data.items():
    fed='/federate' in content
    honor='honor_labels: true' in content
    match='match[]' in content
    ne131='10.144.131' in content and ':9100' in content
    print(f'{fname}: /federate={fed} honor_labels={honor} match[]={match} 131:9100={ne131}')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 4. Lab-3 node-exporter(9100) 포함 여부 ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import json,sys
try:
  data=json.loads(sys.stdin.read())
  for fname,content in data.items():
    lines=[l.strip() for l in content.split('\n') if '10.144.131' in l and '9100' in l]
    if lines:
      print(f'{fname}: found {len(lines)} lines')
      for l in lines[:5]: print(f'  {l[:80]}')
    else:
      print(f'{fname}: no Lab-3:9100 targets')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 5. Lab-3 관련 포트 종류 ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import json,sys,re
try:
  data=json.loads(sys.stdin.read())
  for fname,content in data.items():
    ports=set(re.findall(r'10\.144\.131\.\d+:(\d+)', content))
    hosts_noport=re.findall(r'(s222h[ax]*14ae\d+|g222bx14ae\d+|s121x13ae\d+)(?::(\d+))?', content)
    hports=set(p for _,p in hosts_noport if p)
    print(f'{fname}: IP ports={sorted(ports) or \"none\"}, hostname ports={sorted(hports) or \"none\"}')
except Exception as e: print(f'err: {e}')
" 2>/dev/null
