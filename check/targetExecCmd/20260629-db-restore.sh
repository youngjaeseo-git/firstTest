#!/bin/bash
# 운영 도커 DB 복구 — firsttest_pgdata(데이터) 그대로 5433 포트로 재기동
# ⚠️ 'db' 서비스만 건드림. app / down / down -v 절대 실행 안 함.
# 실행: bash check/targetExecCmd/20260629-db-restore.sh  (권한 필요시 sudo)
cd "$(dirname "$0")/../.." 2>/dev/null || true
echo "=== DB_RESTORE (db only) ==="

# [0] 데이터 볼륨 확인 — postgres 데이터 없으면 중단(빈 DB 생성 방지)
echo "-- [0] firsttest_pgdata 데이터 확인(읽기 전용) --"
PGV=$(docker run --rm -v firsttest_pgdata:/d postgres:16-alpine cat /d/PG_VERSION 2>/dev/null | tr -d '[:space:]')
echo "  PG_VERSION=[$PGV]"
if [ -z "$PGV" ]; then
  echo "  ABORT: firsttest_pgdata에 postgres 데이터가 없음. 임의 재생성 금지 → 중단."
  echo "  (데이터가 다른 볼륨에 있을 수 있음. 멈추고 알려주세요.)"
  exit 1
fi

# [1] .env에 DB_PORT=5433 보장 (앱이 5433 사용, 호스트 postgres 5432와 충돌 회피)
if grep -qE '^DB_PORT=' .env 2>/dev/null; then
  echo "  .env DB_PORT=$(grep -E '^DB_PORT=' .env | cut -d= -f2-)"
else
  printf '\nDB_PORT=5433\n' >> .env
  echo "  .env에 DB_PORT=5433 추가"
fi

# [2] db 서비스만 기동 (5433 publish). app/down 미실행.
echo "-- [2] DB_PORT=5433 docker compose up -d db --"
DB_PORT=5433 docker compose up -d db
echo "  (healthy 대기 최대 30s)"
for i in $(seq 1 30); do
  docker compose ps db 2>/dev/null | grep -q healthy && break
  sleep 1
done

# [3] 검증
echo "-- [3] 상태/데이터 --"
echo "  dcim-db state=$(docker inspect dcim-db --format '{{.State.Status}}' 2>/dev/null) health=$(docker inspect dcim-db --format '{{.State.Health.Status}}' 2>/dev/null)"
echo "  compose_port_db=$(docker compose port db 5432 2>/dev/null)"
echo "  5433_listen=$( (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -c ':5433')"
TABLES=$(docker exec dcim-db psql -U dcim -d dcim -tAc "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null | tr -d '[:space:]')
EQ=$(docker exec dcim-db psql -U dcim -d dcim -tAc 'select count(*) from "Equipment"' 2>/dev/null | tr -d '[:space:]')
echo "  tables=$TABLES  equipment_rows=$EQ"
echo "=== END ==="
# health=healthy, tables>0, equipment_rows>0 → 데이터 복구 성공.
# 다음 단계: bash check/targetExecCmd/20260629-cron-restart.sh (앱 재시작=재연결+CRON_SECRET)
