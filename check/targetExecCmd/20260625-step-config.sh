#!/bin/bash
# EvalPhase.config 필드 추가 (워크로드 스텝 정보)
# 실행: bash check/targetExecCmd/20260625-step-config.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

echo "=== 1. Prisma DB Push ==="
npx prisma db push --accept-data-loss 2>&1 | tail -3

echo "=== 2. config 컬럼 확인 ==="
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then echo "ERR: DB 컨테이너 없음"; exit 1; fi
docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -A -c \
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='EvalPhase' AND column_name='config';"

echo "=== 완료 ==="
