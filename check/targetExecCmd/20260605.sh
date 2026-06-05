#!/bin/bash
# 외부 평가 DB 구조 확인 (타이핑 최소화 — 사내 폐쇄망, 직접 타이핑 전달)
# 사용법: 접속 정보 5줄 수정 후  bash check/targetExecCmd/20260605.sh

EVAL_DB_HOST="여기에_IP_입력"
EVAL_DB_PORT="5432"
EVAL_DB_USER="여기에_사용자_입력"
EVAL_DB_PASS="여기에_비밀번호_입력"
EVAL_DB_NAME="여기에_DB명_입력"

export PGPASSWORD="$EVAL_DB_PASS"
Q="psql -h $EVAL_DB_HOST -p $EVAL_DB_PORT -U $EVAL_DB_USER -d $EVAL_DB_NAME -tAc"

# 1) step/workload/script/phase 관련 컬럼이 있는 테이블만 (가장 중요)
echo "### A. step/workload 관련 컬럼 (테이블.컬럼)"
$Q "SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name)
    FROM information_schema.columns
    WHERE table_schema='public'
      AND lower(column_name) SIMILAR TO '%(step|workload|script|phase|yaml|command)%';"

# 2) server/host 관련 컬럼
echo ""
echo "### B. server/host 관련 컬럼 (테이블.컬럼)"
$Q "SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name)
    FROM information_schema.columns
    WHERE table_schema='public'
      AND lower(column_name) SIMILAR TO '%(server|host|node|machine|ip)%';"

# 3) A에서 나온 테이블들의 전체 컬럼 (한 줄씩) — 구조 파악용
echo ""
echo "### C. 위 관련 테이블의 컬럼 구조"
$Q "SELECT table_name || ': ' || string_agg(column_name, ',' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name IN (
        SELECT DISTINCT table_name FROM information_schema.columns
        WHERE table_schema='public'
          AND lower(column_name) SIMILAR TO '%(step|workload|script|phase|server|host|node)%')
    GROUP BY table_name ORDER BY table_name;"

# 4) step 컬럼의 실제 값 형태 1개만 (앞 80자) — 'step1:vdd up' 형식 확인용
echo ""
echo "### D. step/script 값 샘플 (앞 80자, 1개씩)"
for tc in $($Q "SELECT table_name || '|' || column_name FROM information_schema.columns
    WHERE table_schema='public'
      AND lower(column_name) SIMILAR TO '%(step|script|yaml|command)%' LIMIT 5;"); do
  t="${tc%|*}"; c="${tc#*|}"
  v=$($Q "SELECT left(\"$c\"::text, 80) FROM \"$t\" WHERE \"$c\" IS NOT NULL LIMIT 1;" 2>/dev/null)
  echo "$t.$c = $v"
done

unset PGPASSWORD
