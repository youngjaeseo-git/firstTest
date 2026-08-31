#!/bin/bash
# BMC 프록시 end-to-end 진단 — 6개 레이어 OK/FAIL (38.100에서 실행)
# 출력: 레이어별 한 줄씩, 총 6줄

cd "$(dirname "$0")/../.."
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)

# --- 1. DB 레이어: Room에 bmcProxyUrl 컬럼+값 존재 ---
PROXY_VAL=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -A -c \
  "SELECT COALESCE(\"bmcProxyUrl\", '') FROM \"Room\" WHERE \"bmcProxyUrl\" IS NOT NULL LIMIT 1;" 2>/dev/null)
if [ -n "$PROXY_VAL" ]; then
  echo "1.DB-bmcProxyUrl: OK ($PROXY_VAL)"
else
  echo "1.DB-bmcProxyUrl: FAIL (Room에 bmcProxyUrl 값 없음)"
fi

# --- 2. DB 체인: Equipment→Rack→Room→bmcProxyUrl NULL 없는 체인 수 ---
CHAIN=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -A -c \
  "SELECT count(*) FROM \"Equipment\" e
   JOIN \"Rack\" r ON e.\"rackId\" = r.id
   JOIN \"Room\" rm ON r.\"roomId\" = rm.id
   WHERE e.\"bmcIpAddress\" IS NOT NULL
     AND rm.\"bmcProxyUrl\" IS NOT NULL;" 2>/dev/null)
BROKEN=$(docker exec "$DB_CONTAINER" psql -U dcim -d dcim -t -A -c \
  "SELECT count(*) FROM \"Equipment\" e
   WHERE e.\"bmcIpAddress\" IS NOT NULL
     AND (e.\"rackId\" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM \"Rack\" r
         JOIN \"Room\" rm ON r.\"roomId\" = rm.id
         WHERE r.id = e.\"rackId\" AND rm.\"bmcProxyUrl\" IS NOT NULL
       ));" 2>/dev/null)
if [ "${CHAIN:-0}" -gt 0 ] && [ "${BROKEN:-0}" -eq 0 ]; then
  echo "2.DB-체인: OK (완전체인=${CHAIN}대, 끊김=0)"
else
  echo "2.DB-체인: FAIL (완전체인=${CHAIN:-0}대, 끊김=${BROKEN:-?}대)"
fi

# --- 3. Prisma Client: bmcProxyUrl 필드 인식 ---
PRISMA_CHECK=$(grep -r "bmcProxyUrl" node_modules/.prisma/client/index.js 2>/dev/null | head -1)
if [ -n "$PRISMA_CHECK" ]; then
  echo "3.Prisma-Client: OK (bmcProxyUrl 필드 존재)"
else
  echo "3.Prisma-Client: FAIL (prisma generate 필요)"
fi

# --- 4. 앱 프로세스: 서버 실행 + 응답 ---
APP_RESP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3000 2>/dev/null)
if [ "$APP_RESP" = "200" ] || [ "$APP_RESP" = "302" ] || [ "$APP_RESP" = "307" ]; then
  echo "4.앱-프로세스: OK (HTTP $APP_RESP)"
else
  echo "4.앱-프로세스: FAIL (HTTP $APP_RESP — 재시작 필요)"
fi

# --- 5. 프록시 서버: 131.100:8443 응답 ---
PROXY_RESP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://10.144.131.100:8443/ 2>/dev/null)
if [ "$PROXY_RESP" != "000" ]; then
  echo "5.프록시-서버: OK (HTTP $PROXY_RESP)"
else
  echo "5.프록시-서버: FAIL (131.100:8443 응답없음)"
fi

# --- 6. 네트워크: 38.100→131.100:8443 포트 접근 ---
timeout 5 bash -c "echo >/dev/tcp/10.144.131.100/8443" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "6.네트워크: OK (8443 포트 열림)"
else
  echo "6.네트워크: FAIL (8443 포트 접근 불가)"
fi
