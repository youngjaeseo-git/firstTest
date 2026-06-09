#!/bin/bash
# Lab-3 마스터(10.144.131.100)에서 실행
# 목적: Lab-3 자체 Prometheus 상태 + K8s 모니터링 스택 확인
# 실행: bash check/targetExecCmd/20260609-lab3-local.sh

echo "=== 1. Lab-3 Prometheus 서비스 확인 ==="
kubectl get svc -n monitoring 2>/dev/null | head -10 || echo "kubectl 실패 또는 monitoring 네임스페이스 없음"

echo ""
echo "=== 2. Lab-3 Prometheus Pod 상태 ==="
kubectl get pod -n monitoring 2>/dev/null | head -10 || echo "pod 조회 실패"

echo ""
echo "=== 3. Lab-3 node-exporter DaemonSet ==="
kubectl get ds -A 2>/dev/null | grep -i node-exporter || echo "node-exporter DaemonSet 없음"

echo ""
echo "=== 4. Lab-3 K8s 노드 목록 ==="
kubectl get nodes -o wide 2>/dev/null | awk '{print $1, $2, $6}' | head -30 || echo "노드 조회 실패"

echo ""
echo "=== 5. Lab-3 Prometheus URL 확인 ==="
# ClusterIP 또는 NodePort 확인
kubectl get svc -n monitoring -o wide 2>/dev/null | grep -i prom || echo "Prometheus 서비스 없음"

echo ""
echo "=== 6. Lab-3 Prometheus 타겟 수 (로컬 접근 시도) ==="
# NodePort로 시도
PROM_PORT=$(kubectl get svc -n monitoring 2>/dev/null | grep -i prom | awk '{print $5}' | grep -oP '\d+(?=/TCP)' | tail -1)
if [ -n "$PROM_PORT" ]; then
  TCOUNT=$(curl -s "http://localhost:$PROM_PORT/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  t=d['data']['activeTargets']
  up=sum(1 for x in t if x['health']=='up')
  print(f'total:{len(t)} up:{up} down:{len(t)-up}')
except: print('parse failed')" 2>/dev/null)
  echo "port=$PROM_PORT result=$TCOUNT"
else
  echo "Prometheus 포트를 찾을 수 없음"
fi

echo ""
echo "=== 7. Lab-3 federation 설정 확인 ==="
kubectl get configmap -n monitoring 2>/dev/null | grep -i prom || echo "configmap 없음"

echo ""
echo "=== 8. SRF 4대 (g222bx14ae001~004, .121~.124) ==="
for i in 121 122 123 124; do
  IP="10.144.131.$i"
  ping -c1 -W2 $IP >/dev/null 2>&1 && P="up" || P="down"
  HN=$(ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o BatchMode=yes $IP hostname 2>/dev/null || echo "ssh-fail")
  curl -s --connect-timeout 3 "http://$IP:9100/metrics" >/dev/null 2>&1 && NE="yes" || NE="no"
  echo "$IP ping=$P host=$HN ne=$NE"
done

echo ""
echo "=== 9. SPR 3대 (s121x13ae101~103, .211~.213) ==="
for i in 211 212 213; do
  IP="10.144.131.$i"
  ping -c1 -W2 $IP >/dev/null 2>&1 && P="up" || P="down"
  HN=$(ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o BatchMode=yes $IP hostname 2>/dev/null || echo "ssh-fail")
  curl -s --connect-timeout 3 "http://$IP:9100/metrics" >/dev/null 2>&1 && NE="yes" || NE="no"
  echo "$IP ping=$P host=$HN ne=$NE"
done

echo ""
echo "=== 10. Prometheus에서 SRF/SPR 타겟 확인 ==="
curl -s "http://localhost:30003/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  found=0
  for t in d['data']['activeTargets']:
    inst=t.get('labels',{}).get('instance','')
    if any(x in inst for x in ['131.121','131.122','131.123','131.124','131.211','131.212','131.213','g222bx','s121x13ae10']):
      print(f\"{inst} job={t['labels'].get('job','')} h={t['health']}\")
      found+=1
  if found==0: print('none')
except: print('prom-query-failed')
" 2>/dev/null
