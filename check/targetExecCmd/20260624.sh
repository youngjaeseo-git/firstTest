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
