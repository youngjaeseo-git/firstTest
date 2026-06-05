#!/bin/bash
# fix-eval-migration.sh — 서버에서 1회 실행
# Eval 테이블이 이미 db push로 생성되어 있지만 migration 히스토리에 없는 상태를 해결
# 이 스크립트를 실행하면 migration을 "이미 적용됨"으로 표시합니다.
#
# 사용법: bash scripts/fix-eval-migration.sh

set -euo pipefail
cd "$(dirname "$0")/.."

export PATH=$HOME/opt/node-20/bin:$PATH

# DB 연결 정보
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then
  echo "DB 컨테이너가 실행 중이 아닙니다."
  exit 1
fi

REAL_PASSWORD=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2-)
REAL_PASSWORD="${REAL_PASSWORD:-${DB_PASSWORD:-dcim_password}}"
REAL_PORT=$(docker compose port db 5432 2>/dev/null | cut -d: -f2)
REAL_PORT="${REAL_PORT:-${DB_PORT:-5432}}"
export DATABASE_URL="postgresql://dcim:${REAL_PASSWORD}@localhost:${REAL_PORT}/dcim?schema=public"

echo "=== Eval 테이블 마이그레이션 정리 ==="
echo ""

# Eval 테이블 존재 여부 확인
EVAL_EXISTS=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='EvalProject')" 2>/dev/null)

if [ "$EVAL_EXISTS" = "t" ]; then
  echo "EvalProject 테이블이 이미 존재합니다."
  echo "migration을 '이미 적용됨'으로 표시합니다..."
  echo ""
  npx prisma migrate resolve --applied 20260510120000_add_eval_tables 2>&1
  echo ""
  echo "완료. 이제 migrate deploy가 이 migration을 건너뜁니다."
else
  echo "EvalProject 테이블이 없습니다."
  echo "migrate deploy를 실행하면 자동으로 생성됩니다."
  echo ""
  npx prisma migrate deploy 2>&1
fi

echo ""
echo "현재 migration 상태:"
npx prisma migrate status 2>&1 | tail -10
