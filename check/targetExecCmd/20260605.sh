#!/bin/bash
# 외부 평가 DB 구조 확인
# 사용법:
#   1) 아래 접속 정보 5줄 수정
#   2) bash check/targetExecCmd/20260605.sh
#   3) git add check/results/ && git commit -m "eval db schema" && git push
#      → 타이핑 없이 결과 파일을 push하면 됨

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

# 상세 결과는 전부 파일에 저장 (길어도 됨 — push하면 되니까)
{
echo "########## 1. 전체 테이블 + 행수 ##########"
$Q "SELECT t.table_name || ' (' || COALESCE(s.n_live_tup::text,'?') || ' rows)'
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema='public' ORDER BY t.table_name;"

echo ""
echo "########## 2. 테이블별 전체 컬럼 ##########"
$Q "SELECT table_name || ':' || E'\n  ' || string_agg(column_name || ' (' || data_type || ')', E'\n  ' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema='public'
    GROUP BY table_name ORDER BY table_name;"

echo ""
echo "########## 3. step/workload/script/phase 관련 테이블 샘플 3행 ##########"
for tbl in $($Q "SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command)%')
    ORDER BY table_name;"); do
  echo ""
  echo "===== $tbl (샘플 3행) ====="
  $Q "SELECT row_to_json(t) FROM \"$tbl\" t LIMIT 3;" 2>/dev/null
done

echo ""
echo "########## 4. server/host/node 관련 테이블 샘플 3행 ##########"
for tbl in $($Q "SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema='public'
      AND (lower(column_name) SIMILAR TO '%(server|host|node|machine)%')
    ORDER BY table_name;"); do
  echo ""
  echo "===== $tbl (샘플 3행) ====="
  $Q "SELECT row_to_json(t) FROM \"$tbl\" t LIMIT 3;" 2>/dev/null
done
} > "$RESULT" 2>&1

echo "완료. 결과 저장됨: $RESULT"
echo ""
echo "다음 명령으로 결과를 전달해주세요 (타이핑 최소):"
echo "  git add $RESULT && git commit -m 'eval db schema' && git push"

unset PGPASSWORD
