#!/bin/bash
# Lab-3 ipAddress 누락 장비 + 워크로드 스텝 데이터 확인
# 실행: bash check/targetExecCmd/20260625.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then echo "ERR: DB 컨테이너 없음"; exit 1; fi
DB="docker exec $DB_CONTAINER psql -U dcim -d dcim -t -A"

echo "=== C1: ipAddress 누락 Lab-3 장비 ==="
$DB -c "SELECT id, hostname, \"ipAddress\" FROM \"Equipment\" WHERE hostname LIKE 's222h%' AND (\"ipAddress\" IS NULL OR \"ipAddress\" = '' OR \"ipAddress\" NOT LIKE '10.144.131.%');"

echo "=== C2: 워크로드 프로젝트 샘플 (3개) ==="
$DB -c "SELECT id, name, namespace, status FROM \"WorkloadProject\" LIMIT 3;"

echo "=== C3: 워크로드 프로젝트 컬럼 목록 ==="
$DB -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='WorkloadProject' ORDER BY ordinal_position;"

echo "=== C4: Phase 테이블 존재 여부 + 구조 ==="
$DB -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%phase%';"
$DB -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Phase' ORDER BY ordinal_position;" 2>/dev/null

echo "=== C5: Phase 샘플 (3개) ==="
$DB -c "SELECT id, name, \"projectId\", status FROM \"Phase\" LIMIT 3;" 2>/dev/null || echo "NO_PHASE_TABLE"

echo "=== C6: Step/Task 관련 테이블 ==="
$DB -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE ANY(ARRAY['%step%','%task%','%stage%','%job%']);"

echo "=== C7: 워크로드 YAML 저장 여부 ==="
$DB -c "SELECT column_name FROM information_schema.columns WHERE table_name='WorkloadProject' AND (column_name ILIKE '%yaml%' OR column_name ILIKE '%config%' OR column_name ILIKE '%spec%' OR column_name ILIKE '%step%');" 2>/dev/null || echo "NONE"

echo "=== C8: Prometheus 워크로드 라벨 (1개 샘플) ==="
curl -s "http://10.144.38.100:30003/api/v1/query?query=kube_pod_info%7Bnamespace!%3D%22kube-system%22%7D" 2>/dev/null \
  | python3 -c "
import sys,json
try:
  r=json.load(sys.stdin)['data']['result']
  if r:
    m=r[0]['metric']
    print(','.join(sorted(m.keys())))
  else: print('NO_DATA')
except: print('ERR')
" 2>/dev/null || echo "CURL_FAIL"

echo "=== 완료 ==="
