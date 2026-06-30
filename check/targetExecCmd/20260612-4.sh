#!/bin/bash
# 2026-06-12-4: Lab-1 Prometheus 설정에서 Lab-3(131.x) 관련 job 확인
# ★★★ 38.100에서 실행 ★★★

LAB1="http://10.100.175.248:8080"

echo "=== Lab-1 Prometheus: 전체 job + Lab-3(131.x) 타겟 ==="
timeout 10 curl -s "$LAB1/api/v1/status/config" 2>/dev/null | python3 -c "
import sys,json,yaml
d=json.load(sys.stdin)
cfg=yaml.safe_load(d['data']['yaml'])
sc=cfg.get('scrape_configs',[])
print(f'total jobs: {len(sc)}')
print('')
for s in sc:
  jn=s.get('job_name','?')
  has131=False
  targets_131=[]
  if 'static_configs' in s:
    for st in s['static_configs']:
      for t in st.get('targets',[]):
        if '131.' in t:
          has131=True
          targets_131.append(t)
  # job 이름에 Lab3/lab3/131 포함 여부도 체크
  name_match='lab3' in jn.lower() or '131' in jn or 'hx' in jn.lower() or 'hax' in jn.lower()
  if has131 or name_match:
    print(f'*** {jn} (Lab-3 관련!)')
    for t in targets_131[:3]: print(f'    {t}')
    if len(targets_131)>3: print(f'    ...+{len(targets_131)-3}개')
  else:
    # 간략 출력
    tc=sum(len(st.get('targets',[])) for st in s.get('static_configs',[])) if 'static_configs' in s else 0
    sd='static' if 'static_configs' in s else 'k8s_sd' if 'kubernetes_sd_configs' in s else '?'
    pcm_mark=' [PCM]' if 'pcm' in jn.lower() or 'PCM' in jn else ''
    print(f'  {jn} ({sd}, {tc}targets){pcm_mark}')
" 2>/dev/null

echo ""
echo "=== 끝 ==="
