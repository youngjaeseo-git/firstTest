#!/bin/bash
# DB 구성 결정적 재확인 — 운영 DB가 도커인지 호스트인지, 앱이 실제 어디에 붙는지
# (읽기 전용)
cd "$(dirname "$0")/../.." 2>/dev/null || true
echo "=== DB_RECHECK (read-only) ==="

echo "-- [1] 실행 중 docker 컨테이너 전체 (이름|이미지|포트) --"
docker ps --format '{{.Names}} | {{.Image}} | {{.Ports}}' 2>/dev/null
echo "-- [2] postgres 컨테이너(중지 포함) --"
docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null | grep -iE 'postgres|db'

echo "-- [3] 앱이 실제 쓰는 DATABASE_URL (/proc/PID/environ) — 결정적 --"
APPPID=$(systemctl show dcim -p MainPID --value 2>/dev/null)
echo "  dcim MainPID=$APPPID"
FOUND=""
for p in $APPPID $(pgrep -f 'next-server' 2>/dev/null) $(pgrep -f 'next dev' 2>/dev/null) $(pgrep -fa node 2>/dev/null | grep -i next | awk '{print $1}'); do
  DBU=$(tr '\0' '\n' < /proc/$p/environ 2>/dev/null | grep '^DATABASE_URL=')
  if [ -n "$DBU" ]; then echo "  PID $p DB=$(echo "$DBU" | sed 's#://[^@]*@#://***@#')"; FOUND=1; break; fi
done
[ -z "$FOUND" ] && echo "  (앱 프로세스 DATABASE_URL 못 찾음 — node 프로세스 확인: $(pgrep -fa 'next\|node' 2>/dev/null | grep -iv calico | head -1 | cut -c1-90))"

echo "-- [4] 543x 포트 점유 (docker-proxy면 도커, postgres면 호스트) --"
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':543[0-9]' | sed 's/  */ /g'

echo "-- [5] compose가 보는 db 서비스 (service-start.sh가 이 방식으로 포트 조회) --"
docker compose ps 2>/dev/null | head
echo "  compose_port_db_5432=$(docker compose port db 5432 2>/dev/null)"
echo "  dcim-db: state=$(docker inspect dcim-db --format '{{.State.Status}}' 2>/dev/null) vol=$(docker inspect dcim-db --format '{{range .Mounts}}{{.Name}}{{end}}' 2>/dev/null)"

echo "-- [6] 데이터 행수 비교(가능하면): 호스트 postgres에 dcim DB 있나 --"
echo "  host_5432_dbs=$( (PGCONNECT_TIMEOUT=3 psql -h localhost -p 5432 -U dcim -lqt 2>/dev/null || echo 'n/a(인증/접속불가)') | cut -d'|' -f1 | grep -iE 'dcim' | paste -sd, - )"
echo "=== END ==="
# 해석: [3]의 DB=...@HOST:PORT 가 진실. PORT가 [4]에서 docker-proxy면 도커DB, postgres(pid)면 호스트DB.
