#!/bin/bash
# 2026-06-11: Multi-Prometheus + 온도 외부 DB 사전 확인
# 실행: bash check/targetExecCmd/20260611.sh

PROM_LAB1="http://10.100.175.248:8080"
PROM_LAB3_NP="http://10.144.131.100:30003"
PROM_LAB3_CIP="http://10.97.9.194:8080"

echo "=== 1. Lab-3 Prometheus 접근 확인 ==="

# Lab-1 → Lab-3 NodePort 접근 가능 여부
echo -n "Lab3-NP(131.100:30003): "
timeout 3 curl -s -o /dev/null -w "%{http_code}" "$PROM_LAB3_NP/api/v1/status/config" 2>/dev/null || echo "TIMEOUT"

# Lab-1 → Lab-3 ClusterIP (같은 클러스터면 불가, 확인용)
echo ""
echo -n "Lab3-CIP(10.97.9.194:8080): "
timeout 3 curl -s -o /dev/null -w "%{http_code}" "$PROM_LAB3_CIP/api/v1/status/config" 2>/dev/null || echo "TIMEOUT"

echo ""
echo ""

echo "=== 2. Lab-3 Prometheus 타겟 현황 (접근 가능 시만) ==="
# Lab-3 Prometheus에 타겟이 있는지 (이전에 0개였음)
LAB3_TARGETS=$(timeout 5 curl -s "$PROM_LAB3_NP/api/v1/targets" 2>/dev/null)
if [ -n "$LAB3_TARGETS" ]; then
  echo "$LAB3_TARGETS" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  t=d.get('data',{}).get('activeTargets',[])
  up=sum(1 for x in t if x.get('health')=='up')
  dn=sum(1 for x in t if x.get('health')=='down')
  print(f'targets={len(t)} up={up} down={dn}')
  jobs={}
  for x in t:
    j=x.get('labels',{}).get('job','?')
    h=x.get('health','?')
    jobs.setdefault(j,[0,0])
    if h=='up': jobs[j][0]+=1
    else: jobs[j][1]+=1
  for j,(u,d) in sorted(jobs.items()):
    print(f'  {j}: up={u} down={d}')
except: print('parse-error')
" 2>/dev/null
else
  echo "접근불가 또는 응답없음"
fi

echo ""
echo ""

echo "=== 3. Lab-1 Prometheus에서 Lab-3 서버 메트릭 현황 ==="
# Lab-3 IP 대역(10.144.131.x)에 대한 node-exporter 수집 여부
echo -n "Lab3-NE(131.x): "
timeout 5 curl -s "$PROM_LAB1/api/v1/query?query=count(up{job=\"node-exporter\",instance=~\"10.144.131.*\"})" 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  r=d.get('data',{}).get('result',[])
  print(r[0]['value'][1] if r else '0')
except: print('err')
" 2>/dev/null

# Lab-3 hostname 기반 PCM 메트릭 수집 현황
echo -n "Lab3-PCM(hostname): "
timeout 5 curl -s "$PROM_LAB1/api/v1/query?query=count(up{job=~\"AE-SMC-GNRAP_PCM|AE-SMC-GNRSP_PCM|AE-SMC-SRF_PCM\"})" 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  r=d.get('data',{}).get('result',[])
  print(r[0]['value'][1] if r else '0')
except: print('err')
" 2>/dev/null

echo ""
echo ""

echo "=== 4. 온도 외부 DB 탐색 ==="
# PDU monitoring DB가 어딘가 존재하는지 탐색
# 일반적인 DB 포트 스캔 (사용자가 알려줄 수도 있지만 자동 탐색 시도)
echo "로컬(10.144.38.100) DB 서비스:"
ss -tlnp 2>/dev/null | grep -E ':(5432|3306|1433|1521|27017)\b' | awk '{print $4}' | sort -u || echo "none"

echo ""
echo "Docker 컨테이너 목록 (DB 관련):"
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null | grep -iE 'db|postgres|mysql|mssql|mongo|pdu|temp|monitor' || echo "none"

echo ""
echo "known DB env vars:"
env 2>/dev/null | grep -iE 'DATABASE|DB_|PGHOST|MYSQL|MSSQL|MONGO|PDU|TEMP_DB' | sed 's/=.*PASSWORD.*/=***/' || echo "none"

echo ""
echo "=== 끝 ==="
