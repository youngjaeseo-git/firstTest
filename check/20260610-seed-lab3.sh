#!/bin/bash
# 2026-06-10: Lab-3 서버 24대 DB 등록
# Lab-1(10.144.38.100)에서 실행
# 실행: bash check/20260610-seed-lab3.sh
#
# 사전 조건: Room "Lab-3"가 DB에 존재해야 함 (없으면 자동 생성)
# 등록 대상:
#   GNR-AP 9대: s222hax14ae001~009 (.101~.109)
#   GNR-SP 10대: s222hx14ae001~010 (.111~.120)
#   SRF 4대: g222bx14ae001~004 (.121~.124)
#   SPR 1대: s121x13ae103 (.213)
# 총 24대

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== 1. 기존 Lab-3 등록 현황 ==="
$DB_CMD -c "SELECT count(*) || ' servers' FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%';"

echo ""
echo "=== 2. Room 확인/생성 ==="
LAB3_ROOM=$($DB_CMD -c "SELECT id FROM \"Room\" WHERE name='Lab-3' LIMIT 1;")
if [ -z "$LAB3_ROOM" ]; then
  DC_ID=$($DB_CMD -c "SELECT id FROM \"DataCenter\" LIMIT 1;")
  if [ -z "$DC_ID" ]; then
    echo "DataCenter not found, creating..."
    DC_ID=$($DB_CMD -c "INSERT INTO \"DataCenter\" (id, name, location, \"updatedAt\") VALUES ('dc_main', 'Main DC', 'Building A', now()) ON CONFLICT DO NOTHING RETURNING id;" | tr -d '[:space:]')
    if [ -z "$DC_ID" ]; then
      DC_ID=$($DB_CMD -c "SELECT id FROM \"DataCenter\" LIMIT 1;")
    fi
  fi
  echo "Creating Room Lab-3 (DC=$DC_ID)"
  LAB3_ROOM=$($DB_CMD -c "INSERT INTO \"Room\" (id, name, \"sortOrder\", \"dataCenterId\", \"updatedAt\") VALUES ('room_lab3', 'Lab-3', 2, '$DC_ID', now()) ON CONFLICT DO NOTHING RETURNING id;" | tr -d '[:space:]')
  if [ -z "$LAB3_ROOM" ]; then
    LAB3_ROOM=$($DB_CMD -c "SELECT id FROM \"Room\" WHERE name='Lab-3' LIMIT 1;")
  fi
fi
echo "Lab-3 Room ID: $LAB3_ROOM"

echo ""
echo "=== 3. Lab-3 서버 등록 (중복 시 스킵) ==="

register_server() {
  local HN=$1
  local IP=$2
  local TYPE=$3  # GNR-AP, GNR-SP, SRF, SPR

  # 중복 체크 (hostname 또는 ipAddress)
  local EXISTS=$($DB_CMD -c "SELECT count(*) FROM \"Equipment\" WHERE hostname='$HN' OR \"ipAddress\"='$IP';")
  if [ "$EXISTS" -gt 0 ]; then
    echo "SKIP $HN ($IP) - already exists"
    return
  fi

  local ID="eq_${HN}"
  $DB_CMD -c "INSERT INTO \"Equipment\" (id, hostname, \"ipAddress\", type, status, notes, \"prometheusInstance\", \"updatedAt\")
    VALUES ('$ID', '$HN', '$IP', 'SERVER', 'ACTIVE', 'Lab-3 $TYPE', '$HN', now())
    ON CONFLICT DO NOTHING;" >/dev/null 2>&1
  echo "ADD  $HN ($IP) [$TYPE]"
}

# GNR-AP 9대
for i in $(seq 1 9); do
  NUM=$(printf "%03d" $i)
  register_server "s222hax14ae${NUM}" "10.144.131.$((100+i))" "GNR-AP"
done

# GNR-SP 10대
for i in $(seq 1 10); do
  NUM=$(printf "%03d" $i)
  register_server "s222hx14ae${NUM}" "10.144.131.$((110+i))" "GNR-SP"
done

# SRF 4대
for i in $(seq 1 4); do
  NUM=$(printf "%03d" $i)
  register_server "g222bx14ae${NUM}" "10.144.131.$((120+i))" "SRF"
done

# SPR 1대
register_server "s121x13ae103" "10.144.131.213" "SPR"

echo ""
echo "=== 4. 등록 결과 ==="
$DB_CMD -c "SELECT count(*) || ' total Lab-3 servers' FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%';"
$DB_CMD -c "SELECT hostname, \"ipAddress\", notes FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' ORDER BY \"ipAddress\";"
