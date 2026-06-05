#!/bin/bash
# 외부 평가 DB 구조 확인 (간소화 — 화면에 요약, 파일에 상세)
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

cd "$(dirname "$0")/../.."
RESULT="check/results/20260605-eval-db-schema.txt"
mkdir -p check/results

# 상세 내용은 파일에 저장
{
echo "=== 테이블(행수) ==="
$Q "SELECT string_agg(t.table_name || '(' || COALESCE(s.n_live_tup::text,'?') || ')', ', ' ORDER BY t.table_name)
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema='public';"

echo ""
echo "=== 관련 컬럼 ==="
$Q "SELECT table_name || '.' || column_name || '(' || data_type || ')'
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command|server|host|node|ip|machine|status|name)%')
    ORDER BY table_name, ordinal_position;"

echo ""
echo "=== 전체 컬럼 목록 ==="
$Q "SELECT table_name || ': ' || string_agg(column_name || '(' || data_type || ')', ', ' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema='public'
    GROUP BY table_name ORDER BY table_name;"

echo ""
echo "=== 샘플 (step/workload 관련 테이블) ==="
for tbl in $($Q "SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command)%')
    ORDER BY table_name LIMIT 5;"); do
  echo "--- $tbl ---"
  $Q "SELECT row_to_json(t) FROM \"$tbl\" t LIMIT 1;" 2>/dev/null || $Q "SELECT * FROM \"$tbl\" LIMIT 1;" 2>/dev/null
  echo ""
done
} > "$RESULT" 2>&1

# 화면에는 요약만
TBL_COUNT=$($Q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
REL_COL=$($Q "SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command|server|host|node|ip)%');")
echo "=== 결과 ==="
echo "테이블: ${TBL_COUNT}개, 관련컬럼: ${REL_COL}개"
echo "상세 저장: $RESULT"
echo ""
echo "이 2줄만 알려주시면 됩니다. 상세 내용은 git push 후 제가 파일로 읽겠습니다."

unset PGPASSWORD
