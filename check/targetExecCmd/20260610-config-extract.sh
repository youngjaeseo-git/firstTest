#!/bin/bash
# 2026-06-10: Lab-1 Prometheus ConfigMap — 미확인 사항 2가지만 추출
# Lab-1(10.144.38.100)에서 실행
# 실행: bash check/targetExecCmd/20260610-config-extract.sh

echo "=== 1. federation 확인 (이전 결과 모순 해소) ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import json,sys,yaml
try:
  data=json.loads(sys.stdin.read())
  for fname,content in data.items():
    cfg=yaml.safe_load(content)
    if not isinstance(cfg, dict) or 'scrape_configs' not in cfg: continue
    for j in cfg.get('scrape_configs',[]):
      path=j.get('metrics_path','/metrics')
      honor=j.get('honor_labels',False)
      if path=='/federate' or honor==True:
        print(f'{fname}: job={j[\"job_name\"]} path={path} honor={honor}')
    # raw 문자열 검색도 병행
    if '/federate' in content: print(f'{fname}: raw contains /federate')
    else: print(f'{fname}: no /federate')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 2. Lab-3 node-exporter(131 대역 :9100) 포함 여부 ==="
kubectl get configmap prometheus-server-conf -n monitoring -o jsonpath='{.data}' 2>/dev/null | python3 -c "
import json,sys
try:
  data=json.loads(sys.stdin.read())
  for fname,content in data.items():
    lines=[l.strip() for l in content.split('\n') if '10.144.131' in l and '9100' in l]
    if lines:
      print(f'{fname}: {len(lines)} lines with 131:9100')
      for l in lines[:5]: print(f'  {l[:80]}')
    else:
      print(f'{fname}: no 131:9100')
except Exception as e: print(f'err: {e}')
" 2>/dev/null
