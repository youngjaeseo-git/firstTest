#!/bin/bash
# DB 스키마 드리프트 진단 — 최근 추가된 컬럼/테이블이 운영 DB에 있는지 확인
# (capacity/reports 크래시 원인 추정: 마이그레이션 미반영)
# 실행: 서버에서 bash check/targetExecCmd/20260630-schema-drift.sh
echo "=== SCHEMA_DRIFT ==="
# 도커 DB(dcim-db) 우선, 없으면 로컬 psql
if docker exec dcim-db true 2>/dev/null; then
  P="docker exec dcim-db psql -U dcim -d dcim -tAc"
elif command -v psql >/dev/null 2>&1; then
  P="psql -h localhost -p 5433 -U dcim -d dcim -tAc"
else
  echo "ERR: DB 접근 불가"; exit 1
fi

echo "각 값 1=존재 / 0=없음(드리프트):"
$P "SELECT
 'Room.bmcProxyUrl=' || (SELECT count(*) FROM information_schema.columns WHERE table_name='Room' AND column_name='bmcProxyUrl')
 || ' | Organization_table=' || (SELECT count(*) FROM information_schema.tables WHERE table_name='Organization')
 || ' | Equipment.organizationId=' || (SELECT count(*) FROM information_schema.columns WHERE table_name='Equipment' AND column_name='organizationId')
 || ' | EvalPhase.config=' || (SELECT count(*) FROM information_schema.columns WHERE table_name='EvalPhase' AND column_name='config');"
echo "=== END ==="
# 하나라도 0이면 = 스키마 드리프트. 해결: 서버에서 'npx prisma db push' (additive라 데이터 안전)
#   또는 'sudo bash scripts/rebuild-prod.sh'(내부에서 prisma db push 수행).
