#!/bin/bash
# Prometheus 진단 + node-exporter 동작 확인 스크립트
# 실행: bash check/20260513-prometheus-diagnosis.sh

PROM=http://10.100.175.248:8080

echo "============================================"
echo "  [신규] node-exporter 동작 확인"
echo "============================================"

echo ""
echo "=== H. node-exporter DaemonSet 상태 ==="
kubectl -n monitoring get daemonset node-exporter 2>&1

echo ""
echo "=== I. node-exporter 파드 상태 (Running만) ==="
kubectl -n monitoring get pods -l app=node-exporter --field-selector=status.phase=Running -o wide 2>&1 | head -25

echo ""
echo "=== J. Prometheus에서 node-exporter job 타겟 ==="
curl -s $PROM/api/v1/targets | python3 -c "
import sys,json
d=json.load(sys.stdin)
targets=d.get('data',{}).get('activeTargets',[])
ne=[t for t in targets if t['labels'].get('job','')=='node-exporter']
print('node-exporter targets: ' + str(len(ne)))
for t in ne[:5]:
    print('  ' + t['labels'].get('instance','?') + ' -> ' + t.get('health','?'))
if len(ne)>5: print('  ... and ' + str(len(ne)-5) + ' more')
" 2>&1

echo ""
echo "=== K. node-exporter 샘플 메트릭 (node_cpu_seconds_total) ==="
curl -s "$PROM/api/v1/query?query=count(node_cpu_seconds_total)" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print('node_cpu_seconds_total series count: ' + r[0]['value'][1])
else: print('node_cpu_seconds_total: NO DATA (node-exporter not scraped)')
" 2>&1

echo ""
echo "=== L. node-exporter 샘플 메트릭 (node_memory_MemTotal_bytes) ==="
curl -s "$PROM/api/v1/query?query=node_memory_MemTotal_bytes" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
print('Nodes with memory data: ' + str(len(r)))
for item in r[:3]:
    inst=item['metric'].get('instance','?')
    val=float(item['value'][1])
    print('  ' + inst + ': ' + str(round(val/1024/1024/1024,1)) + ' GB')
" 2>&1

echo ""
echo "============================================"
echo "  [기존] Prometheus 전체 상태"
echo "============================================"

echo ""
echo "=== A. Prometheus가 로드한 설정 (job 목록) ==="
curl -s $PROM/api/v1/status/config | python3 -c "
import sys,json
d=json.load(sys.stdin)
config=d.get('data',{}).get('yaml','')
jobs=[line.strip() for line in config.split('\n') if 'job_name' in line]
print('Loaded jobs: ' + str(len(jobs)))
for j in jobs: print('  ' + j)
" 2>&1

echo ""
echo "=== B. Prometheus 로그 (최근 30줄) ==="
kubectl -n monitoring logs deployment/prometheus-deployment --tail=30 2>&1

echo ""
echo "=== C. ClusterRoleBinding 확인 ==="
kubectl get clusterrolebinding prometheus -o yaml 2>&1 | grep -A5 subjects

echo ""
echo "=== D. Deployment ServiceAccount 확인 ==="
SA=$(kubectl -n monitoring get deployment prometheus-deployment -o jsonpath='{.spec.template.spec.serviceAccountName}' 2>&1)
echo "ServiceAccount: [$SA]"

echo ""
echo "=== E. 파드 상태 ==="
kubectl -n monitoring get pods -l app=prometheus-server -o wide 2>&1

echo ""
echo "=== F. 타겟 현황 ==="
curl -s $PROM/api/v1/targets | python3 -c "
import sys,json
d=json.load(sys.stdin)
targets=d.get('data',{}).get('activeTargets',[])
by_job={}
for t in targets:
    j=t['labels'].get('job','unknown')
    s=t.get('health','unknown')
    by_job.setdefault(j,[0,0])
    if s=='up': by_job[j][0]+=1
    else: by_job[j][1]+=1
for j,v in sorted(by_job.items()):
    print(j + ': up=' + str(v[0]) + ', down=' + str(v[1]))
print('Total active targets: ' + str(len(targets)))
" 2>&1

echo ""
echo "=== G. ConfigMap 현재 job 목록 (kubectl 직접 조회) ==="
kubectl -n monitoring get configmap prometheus-server-conf -o jsonpath='{.data.prometheus\.yml}' 2>&1 | grep "job_name" | head -20
