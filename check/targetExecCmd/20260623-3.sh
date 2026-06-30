#!/bin/bash
# DB 마이그레이션: User.approved 필드 추가 후 기존 사용자 승인 처리
# 실행: bash check/targetExecCmd/20260623-3.sh
# rebuild-prod.sh 실행 후에 실행

cd /home/dcim/firstTest

echo "=== 1. Prisma DB Push ==="
npx prisma db push --skip-generate 2>&1 | tail -3

echo ""
echo "=== 2. 기존 사용자 전체 승인 처리 ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -c 'UPDATE "User" SET approved = true WHERE approved = false OR approved IS NULL;'

echo ""
echo "=== 3. 확인 ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -c 'SELECT email, role, approved FROM "User";'
