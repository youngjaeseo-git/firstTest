#!/bin/bash
# Organization 모델 DB 마이그레이션 (Air-Gapped Safe)
# 실행: bash check/targetExecCmd/20260624.sh
# DCIM 앱 서버(10.144.38.100)에서 실행

echo "=== Organization 스키마 적용 ==="
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || { echo "ERR: 프로젝트 디렉토리 이동 실패"; exit 1; }

npx prisma db push --accept-data-loss 2>&1 | tail -3
echo ""

echo "=== 새 테이블 확인 ==="
npx prisma db execute --stdin <<'SQL' 2>/dev/null
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('Organization','UserOrganization') ORDER BY tablename;
SQL

echo "=== 완료 ==="

echo ""
echo "=========================================="
echo "=== Lab-3 모니터링 검증 ==="
echo "=========================================="

PROM="http://10.144.38.100:30003"

echo "--- B4: Lab-3 장비 DB ipAddress 확인 ---"
docker exec dcim-db psql -U dcim -d dcim -t -A -c \
  "SELECT COUNT(*), COUNT(CASE WHEN \"ipAddress\" LIKE '10.144.131.%' THEN 1 END) FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' OR hostname LIKE 's222h%';"

echo "--- B5-1: Lab-3 PCM UP/DOWN ---"
for JOB in AE-SMC-GNRAP_PCM AE-SMC-GNRSP_PCM; do
  curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22${JOB}%22%7D" 2>/dev/null \
    | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)['data']['result']
  u=sum(1 for r in d if r['value'][1]=='1')
  dn=sum(1 for r in d if r['value'][1]=='0')
  print(f'$JOB: up={u} down={dn}')
except: print('$JOB: ERR')
" 2>/dev/null || echo "$JOB: CURL_FAIL"
done

echo "--- B5-2: kube_pod_info node 라벨 형식 (1개 샘플) ---"
curl -s "http://10.144.131.190:30003/api/v1/query?query=kube_pod_info%7Bnamespace!%3D%22kube-system%22%7D" 2>/dev/null \
  | python3 -c "
import sys,json
try:
  r=json.load(sys.stdin)['data']['result']
  if r: print('node='+r[0]['metric'].get('node','?'))
  else: print('NO_DATA')
except: print('ERR')
" 2>/dev/null || echo "LAB3_PROM_FAIL"

echo "--- B5-3: Lab-3 NE instance 형식 (1개 샘플) ---"
curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.131.*%22%7D" 2>/dev/null \
  | python3 -c "
import sys,json
try:
  r=json.load(sys.stdin)['data']['result']
  if r: print('instance='+r[0]['metric'].get('instance','?')+' total='+str(len(r)))
  else: print('NO_LAB3_NE')
except: print('ERR')
" 2>/dev/null || echo "CURL_FAIL"

echo "=== Lab-3 검증 완료 ==="
