#!/bin/bash
# 외부 평가 DB 구조 확인 스크립트
# 사용법: bash check/targetExecCmd/20260605.sh
#
# *** 아래 접속 정보를 실제 값으로 수정한 후 실행 ***

EVAL_DB_HOST="여기에_IP_입력"
EVAL_DB_PORT="5432"
EVAL_DB_USER="여기에_사용자_입력"
EVAL_DB_PASS="여기에_비밀번호_입력"
EVAL_DB_NAME="여기에_DB명_입력"

export PGPASSWORD="$EVAL_DB_PASS"

echo "=== 1. 연결 테스트 ==="
psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -c "SELECT version();" 2>&1 | head -3

echo ""
echo "=== 2. 전체 테이블 목록 ==="
psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -tAc \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"

echo ""
echo "=== 3. 각 테이블 행 수 + 컬럼 목록 (상위 30개 테이블) ==="
for tbl in $(psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -tAc \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name LIMIT 30;"); do
  count=$(psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -tAc \
    "SELECT count(*) FROM \"$tbl\";" 2>/dev/null || echo "?")
  cols=$(psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -tAc \
    "SELECT string_agg(column_name || '(' || data_type || ')', ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='$tbl';")
  echo ""
  echo "--- $tbl ($count rows) ---"
  echo "  $cols"
done

echo ""
echo "=== 4. 'step' 또는 'workload' 관련 테이블/컬럼 검색 ==="
psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -tAc \
  "SELECT table_name, column_name, data_type FROM information_schema.columns
   WHERE table_schema='public'
     AND (lower(column_name) LIKE '%step%' OR lower(column_name) LIKE '%workload%'
       OR lower(column_name) LIKE '%script%' OR lower(column_name) LIKE '%phase%'
       OR lower(column_name) LIKE '%yaml%' OR lower(column_name) LIKE '%command%')
   ORDER BY table_name, ordinal_position;"

echo ""
echo "=== 5. 'server' 또는 'host' 관련 컬럼 검색 ==="
psql -h "$EVAL_DB_HOST" -p "$EVAL_DB_PORT" -U "$EVAL_DB_USER" -d "$EVAL_DB_NAME" -tAc \
  "SELECT table_name, column_name, data_type FROM information_schema.columns
   WHERE table_schema='public'
     AND (lower(column_name) LIKE '%server%' OR lower(column_name) LIKE '%host%'
       OR lower(column_name) LIKE '%node%' OR lower(column_name) LIKE '%ip%'
       OR lower(column_name) LIKE '%machine%')
   ORDER BY table_name, ordinal_position;"

echo ""
echo "=== 완료 ==="
echo "결과를 check/results/20260605-eval-db-schema.md 에 저장해주세요"

unset PGPASSWORD
