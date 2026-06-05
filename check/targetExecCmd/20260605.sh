#!/bin/bash
# 외부 평가 DB 구조 확인 (간소화 버전)
# 사용법: bash check/targetExecCmd/20260605.sh
#
# *** 아래 접속 정보를 실제 값으로 수정한 후 실행 ***

EVAL_DB_HOST="여기에_IP_입력"
EVAL_DB_PORT="5432"
EVAL_DB_USER="여기에_사용자_입력"
EVAL_DB_PASS="여기에_비밀번호_입력"
EVAL_DB_NAME="여기에_DB명_입력"

export PGPASSWORD="$EVAL_DB_PASS"
Q="psql -h $EVAL_DB_HOST -p $EVAL_DB_PORT -U $EVAL_DB_USER -d $EVAL_DB_NAME -tAc"

# 1) 테이블 목록 + 행 수 (한줄로)
echo "=== 테이블(행수) ==="
$Q "SELECT string_agg(t.table_name || '(' || COALESCE(s.n_live_tup::text,'?') || ')', ', ' ORDER BY t.table_name)
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema='public';"

# 2) step/workload/script/server/host 관련 컬럼만
echo ""
echo "=== 관련 컬럼 ==="
$Q "SELECT table_name || '.' || column_name || '(' || data_type || ')'
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command|server|host|node|ip|machine|status|name)%')
    ORDER BY table_name, ordinal_position;"

# 3) 가장 관련 높은 테이블에서 샘플 1행
echo ""
echo "=== 샘플 (step/workload 포함 테이블) ==="
for tbl in $($Q "SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command)%')
    ORDER BY table_name LIMIT 5;"); do
  echo "--- $tbl (1행) ---"
  $Q "SELECT row_to_json(t) FROM \"$tbl\" t LIMIT 1;" 2>/dev/null | python3 -m json.tool 2>/dev/null || $Q "SELECT * FROM \"$tbl\" LIMIT 1;" 2>/dev/null
  echo ""
done

unset PGPASSWORD
