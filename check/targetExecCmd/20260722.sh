#!/bin/bash
# Lab-1 앱 서버에서 실행. 222HA-TN 모델의 BIOS 버전이 왜 2개로 갈리는지 실제 DB 값 확인.
# 출력 최소화 — 결과를 눈으로 보고 전달용.
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
cd "$(cd "$(dirname "$0")/../.." && pwd)"

DB=$(docker compose ps -q db 2>/dev/null)
[ -z "$DB" ] && { echo "dcim-db 컨테이너 없음 — 여기가 앱(Lab-1) 서버 맞는지 확인"; exit 1; }

# 222ha 관련 서버들의 hostname / 정확한 biosVersion 문자열 / 조직 / 갱신일
docker exec "$DB" psql -U dcim -d dcim -At -F ' | ' -c "
SELECT hostname,
       '['||coalesce(\"biosVersion\",'NULL')||']' AS bios,
       to_char(\"updatedAt\",'YY-MM-DD') AS updated
FROM \"Equipment\"
WHERE model ILIKE '%222ha%' OR hostname ILIKE '%222ha%'
ORDER BY \"biosVersion\", hostname;"

echo '--- 버전 문자열별 대수 (형식 차이 한눈에) ---'
docker exec "$DB" psql -U dcim -d dcim -At -F ' x' -c "
SELECT '['||coalesce(\"biosVersion\",'NULL')||']', count(*)
FROM \"Equipment\"
WHERE model ILIKE '%222ha%' OR hostname ILIKE '%222ha%'
GROUP BY \"biosVersion\" ORDER BY count(*) DESC;"
