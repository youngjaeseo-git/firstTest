#!/bin/bash
# 2026-06-10: Lab-1 Prometheus config 정밀 분석
# 목적: Lab-1 Prometheus의 실제 scrape 구조 확인 (federation 여부, job별 타겟, :9200 정체)
# 실행: bash check/targetExecCmd/20260610-prom-config.sh
# 비교: 사용자가 직접 확인하는 prometheus.yml 원본과 대조

PROM="http://10.144.38.100:30003"

echo "=== 1. job_name 전체 목록 + 타입 ==="
# 각 job이 어떤 service discovery 방식인지 (static / kubernetes_sd / federate path 등)
curl -s "$PROM/api/v1/status/config" 2>/dev/null | python3 -c "
import json,sys,yaml
try:
  d=json.load(sys.stdin)
  cfg=yaml.safe_load(d['data']['yaml'])
  for j in cfg.get('scrape_configs',[]):
    name=j.get('job_name','?')
    path=j.get('metrics_path','/metrics')
    sd=[]
    if 'static_configs' in j: sd.append('static')
    if 'kubernetes_sd_configs' in j: sd.append('k8s_sd')
    if 'file_sd_configs' in j: sd.append('file_sd')
    honor=j.get('honor_labels','')
    fed='FEDERATE' if path=='/federate' else ''
    print(f\"{name} path={path} sd={','.join(sd) or 'none'} honor={honor} {fed}\")
except Exception as e: print(f'parse-err: {e}')
" 2>/dev/null

echo ""
echo "=== 2. :9200 포트를 쓰는 job 식별 ==="
# 131:9200 타겟이 어느 job에 속하는지 + 그 job의 메트릭 경로
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  seen={}
  for t in d['data']['activeTargets']:
    inst=t.get('labels',{}).get('instance','')
    if ':9200' in inst:
      job=t.get('labels',{}).get('job','?')
      seen.setdefault(job,{'count':0,'sample':inst,'health':t.get('health')})
      seen[job]['count']+=1
  for job,v in seen.items():
    print(f\"job={job} count={v['count']} sample={v['sample']} health={v['health']}\")
  if not seen: print('no :9200 targets')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 3. :9200 타겟이 내보내는 메트릭 종류 (1개 샘플) ==="
# 9200이 node-exporter인지 PCM인지 server-info인지 메트릭 이름으로 판별
curl -sg "$PROM/api/v1/query?query=group(node_cpu_seconds_total{instance=~\"10.144.131.*:9200\"})%20by%20(__name__)" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  r=d.get('data',{}).get('result',[])
  print(f'node_cpu_seconds_total on :9200 = {\"YES (node-exporter)\" if r else \"NO\"}')
except: print('query-fail')
" 2>/dev/null
# PCM 메트릭 확인
curl -sg "$PROM/api/v1/query?query=group({instance=~\"10.144.131.111:9200\"})%20by%20(__name__)" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  r=d.get('data',{}).get('result',[])
  names=sorted(set(x['metric'].get('__name__','') for x in r))[:15]
  print(f':9200 metric count={len(r)}, samples: {\", \".join(names)}')
except Exception as e: print(f'query-fail: {e}')
" 2>/dev/null

echo ""
echo "=== 4. federation 흔적 확인 ==="
# /federate path, honor_labels:true, prometheus job 등 federation 특징
curl -s "$PROM/api/v1/status/config" 2>/dev/null | python3 -c "
import json,sys,yaml
try:
  d=json.load(sys.stdin)
  raw=d['data']['yaml']
  cfg=yaml.safe_load(raw)
  fed_jobs=[j['job_name'] for j in cfg.get('scrape_configs',[]) if j.get('metrics_path')=='/federate']
  honor_jobs=[j['job_name'] for j in cfg.get('scrape_configs',[]) if j.get('honor_labels')==True]
  print(f'federate-path jobs: {fed_jobs or \"none\"}')
  print(f'honor_labels=true jobs: {honor_jobs or \"none\"}')
  print(f'raw contains \"/federate\": {\"/federate\" in raw}')
  print(f'raw contains \"match[]\": {\"match[]\" in raw}')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 5. Lab-3 IP가 들어간 job별 분류 ==="
# 131 대역 타겟을 job별로 묶어서 출력
curl -s "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  byjob={}
  for t in d['data']['activeTargets']:
    inst=t.get('labels',{}).get('instance','')
    if '10.144.131.' in inst or '131' in t.get('labels',{}).get('instance',''):
      if '131' not in inst: continue
      job=t.get('labels',{}).get('job','?')
      byjob.setdefault(job,{'up':0,'down':0,'sample':inst})
      if t.get('health')=='up': byjob[job]['up']+=1
      else: byjob[job]['down']+=1
  for job,v in sorted(byjob.items()):
    print(f\"{job}: up={v['up']} down={v['down']} sample={v['sample']}\")
  if not byjob: print('no 131 targets')
except Exception as e: print(f'err: {e}')
" 2>/dev/null

echo ""
echo "=== 6. config 전체 줄 수 + job 개수 (원본 대조용) ==="
curl -s "$PROM/api/v1/status/config" 2>/dev/null | python3 -c "
import json,sys,yaml
try:
  d=json.load(sys.stdin)
  raw=d['data']['yaml']
  cfg=yaml.safe_load(raw)
  print(f'total lines={len(raw.splitlines())} scrape_jobs={len(cfg.get(\"scrape_configs\",[]))}')
  print('job names: ' + ', '.join(j.get('job_name','?') for j in cfg.get('scrape_configs',[])))
except Exception as e: print(f'err: {e}')
" 2>/dev/null
