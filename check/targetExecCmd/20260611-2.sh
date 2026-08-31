#!/bin/bash
# 2026-06-11-2: Multi-Prometheus URL 확인
# Grafana 데이터소스에서 Cluster 2 Prometheus URL 추출
# 실행: bash check/targetExecCmd/20260611-2.sh

GRAFANA="http://10.144.38.100:30004"

echo "=== 1. Grafana 데이터소스 목록 ==="
# Grafana API로 데이터소스 조회 (익명접근 또는 admin:admin)
DS=$(timeout 5 curl -s "$GRAFANA/api/datasources" 2>/dev/null)
if [ -z "$DS" ]; then
  DS=$(timeout 5 curl -s -u admin:admin "$GRAFANA/api/datasources" 2>/dev/null)
fi
if [ -n "$DS" ]; then
  echo "$DS" | python3 -c "
import sys,json
try:
  ds=json.load(sys.stdin)
  if isinstance(ds, list):
    for d in ds:
      print(f\"{d.get('name','?')} | type={d.get('type','?')} | url={d.get('url','?')} | default={d.get('isDefault',False)}\")
  else:
    print('not-list: '+str(ds)[:200])
except Exception as e: print(f'parse-err: {e}')
" 2>/dev/null
else
  echo "Grafana 응답 없음"
fi

echo ""
echo "=== 2. 모니터링 워커 노드(10.144.131.190) Prometheus 확인 ==="
# 일반적인 Prometheus 포트: 9090, 8080, 30003
for PORT in 9090 8080 30003; do
  echo -n "131.190:$PORT -> "
  CODE=$(timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://10.144.131.190:$PORT/api/v1/status/config" 2>/dev/null)
  echo "${CODE:-TIMEOUT}"
done

echo ""
echo "=== 3. Cluster 2 Prometheus 타겟 요약 (접근 가능 시) ==="
# 위에서 접근 가능한 포트가 있으면 타겟 확인
for PORT in 9090 8080 30003; do
  RESP=$(timeout 5 curl -s "http://10.144.131.190:$PORT/api/v1/targets" 2>/dev/null)
  if echo "$RESP" | grep -q '"status":"success"' 2>/dev/null; then
    echo "Port $PORT 응답 성공:"
    echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
t=d.get('data',{}).get('activeTargets',[])
up=sum(1 for x in t if x.get('health')=='up')
dn=sum(1 for x in t if x.get('health')=='down')
print(f'  total={len(t)} up={up} down={dn}')
jobs={}
for x in t:
  j=x.get('labels',{}).get('job','?')
  h=x.get('health','?')
  jobs.setdefault(j,[0,0])
  if h=='up': jobs[j][0]+=1
  else: jobs[j][1]+=1
for j,(u,d) in sorted(jobs.items()):
  print(f'  {j}: up={u} down={d}')
" 2>/dev/null
    break
  fi
done

echo ""
echo "=== 4. DCIM서버(Lab-1)에서 Cluster 2 Prometheus 접근 ==="
# Lab-3 Prometheus의 ClusterIP (이전 확인: 10.97.9.194:8080)
echo -n "Lab3 ClusterIP(10.97.9.194:8080): "
timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://10.97.9.194:8080/api/v1/status/config" 2>/dev/null || echo "TIMEOUT"

# Lab-3 NodePort (10.144.131.100:30003)
echo ""
echo -n "Lab3 NodePort(131.100:30003): "
timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://10.144.131.100:30003/api/v1/status/config" 2>/dev/null || echo "TIMEOUT"

# 모니터링 워커 직접
echo ""
echo -n "Lab3 Monitor(131.190:8080): "
timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://10.144.131.190:8080/api/v1/status/config" 2>/dev/null || echo "TIMEOUT"

echo ""
echo "=== 끝 ==="
