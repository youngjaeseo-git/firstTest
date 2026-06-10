#!/bin/bash
# 2026-06-10: Lab-3 Room 중복 제거
# DB에 "Lab-3" Room이 2개 존재 (하나는 rack 4개, 하나는 0개)
# rack 0개인 빈 Room을 삭제한다.
# 실행: bash check/20260610-fix-dup-lab3-room.sh

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== 1. Lab-3 Room 현황 ==="
$DB_CMD -c "SELECT r.id, r.name, count(rk.id) AS racks
  FROM \"Room\" r LEFT JOIN \"Rack\" rk ON rk.\"roomId\"=r.id
  WHERE r.name LIKE '%Lab%3%' OR r.name LIKE '%lab%3%'
  GROUP BY r.id, r.name ORDER BY racks DESC;"

echo ""
echo "=== 2. 빈 Lab-3 삭제 ==="
$DB_CMD -c "DELETE FROM \"Room\" WHERE id IN (
  SELECT r.id FROM \"Room\" r
  LEFT JOIN \"Rack\" rk ON rk.\"roomId\"=r.id
  WHERE (r.name LIKE '%Lab%3%' OR r.name LIKE '%lab%3%')
  GROUP BY r.id
  HAVING count(rk.id)=0
);"

echo ""
echo "=== 3. 전체 Room 목록 ==="
$DB_CMD -c "SELECT r.name, count(rk.id) AS racks
  FROM \"Room\" r LEFT JOIN \"Rack\" rk ON rk.\"roomId\"=r.id
  GROUP BY r.id, r.name ORDER BY r.\"sortOrder\";"
