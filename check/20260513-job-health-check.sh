#!/bin/bash
# Prometheus job 상태 점검 — down 타겟 원인 조사용
# 실행: bash check/20260513-job-health-check.sh

PROM=http://10.100.175.248:8080

echo "================================================================"
echo " Prometheus Job 상태 점검"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"

echo ""
echo "=== 1. Job별 up/down 요약 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
by_job={}
for t in targets:
    j=t['labels'].get('job','unknown')
    h=t.get('health','unknown')
    by_job.setdefault(j,{'up':0,'down':0,'total':0})
    by_job[j]['total']+=1
    if h=='up': by_job[j]['up']+=1
    else: by_job[j]['down']+=1

print('  ' + '-'*60)
print('  {:<35s} {:>5s} {:>5s} {:>5s}'.format('JOB','UP','DOWN','TOTAL'))
print('  ' + '-'*60)
for j in sorted(by_job.keys()):
    v=by_job[j]
    mark=' !!!' if v['down']>0 else ''
    print('  {:<35s} {:>5d} {:>5d} {:>5d}{}'.format(j,v['up'],v['down'],v['total'],mark))
print('  ' + '-'*60)
print('  !!! = down 타겟 있음')
" 2>&1

echo ""
echo "=== 2. DOWN 타겟 상세 (job별 IP, 마지막 scrape, 에러) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
down=[t for t in targets if t.get('health')!='up']

by_job={}
for t in down:
    j=t['labels'].get('job','unknown')
    by_job.setdefault(j,[])
    by_job[j].append(t)

if not by_job:
    print('  DOWN 타겟 없음 - 모두 정상')
else:
    for j in sorted(by_job.keys()):
        items=by_job[j]
        print('')
        print('  [' + j + '] down=' + str(len(items)))
        for t in items[:10]:
            inst=t['labels'].get('instance','?')
            url=t.get('scrapeUrl','?')
            last=t.get('lastScrape','?')
            err=t.get('lastError','')
            if len(err)>80: err=err[:80]+'...'
            print('    instance: ' + inst)
            print('    scrapeUrl: ' + url)
            print('    lastScrape: ' + last)
            if err: print('    lastError: ' + err)
            print('    ---')
        if len(items)>10:
            print('    ... +' + str(len(items)-10) + ' more')
" 2>&1

echo ""
echo "=== 3. DOWN 타겟 IP 목록 (ping/접속 확인용) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
down=[t for t in targets if t.get('health')!='up']

by_job={}
for t in down:
    j=t['labels'].get('job','unknown')
    inst=t['labels'].get('instance','?')
    ip=inst.split(':')[0]
    by_job.setdefault(j,set())
    by_job[j].add(ip)

for j in sorted(by_job.keys()):
    ips=sorted(by_job[j])
    print('  [' + j + '] ' + str(len(ips)) + ' unique IPs:')
    for ip in ips:
        print('    ' + ip)
" 2>&1

echo ""
echo "=== 4. temperature job 상태 (온도/팬 데이터 소스) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
temp=[t for t in targets if t['labels'].get('job')=='temperature']
if not temp:
    print('  temperature job: 타겟 없음 (job 자체가 없거나 삭제됨)')
else:
    for t in temp:
        inst=t['labels'].get('instance','?')
        h=t.get('health','?')
        err=t.get('lastError','')
        print('  instance=' + inst + ' health=' + h)
        if err: print('  lastError: ' + err)
" 2>&1

echo ""
echo "=== 5. node-exporter job 상태 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
targets=d.get('data',{}).get('activeTargets',[])
ne=[t for t in targets if t['labels'].get('job')=='node-exporter']
up=[t for t in ne if t.get('health')=='up']
down=[t for t in ne if t.get('health')!='up']
print('  node-exporter: up=' + str(len(up)) + ', down=' + str(len(down)) + ', total=' + str(len(ne)))
if down:
    print('  [DOWN]')
    for t in down[:10]:
        inst=t['labels'].get('instance','?')
        err=t.get('lastError','')
        if len(err)>60: err=err[:60]+'...'
        print('    ' + inst + ' -> ' + (err or 'no error info'))
" 2>&1

echo ""
echo "================================================================"
echo " 점검 완료"
echo " down 타겟의 IP가 변경되었는지 확인: ping 또는 서버 인벤토리 대조"
echo " ConfigMap 수정: kubectl -n monitoring edit configmap prometheus-server-conf"
echo "================================================================"
