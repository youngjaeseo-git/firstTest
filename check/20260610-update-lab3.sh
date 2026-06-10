#!/bin/bash
# 2026-06-10: Lab-3 서버 추가 정보 업데이트
# Lab-1(10.144.38.100)에서 실행
# 실행: bash check/20260610-update-lab3.sh
#
# 업데이트 내용:
#   - BMC IP (192.168.10.{마지막옥텟})
#   - Rack 생성 및 서버 배치 (Lab-3 Room)
#   - manufacturer, model 기본값 설정

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== 1. Lab-3 Room/Rack 확인 ==="
LAB3_ROOM=$($DB_CMD -c "SELECT id FROM \"Room\" WHERE name='Lab-3' LIMIT 1;")
if [ -z "$LAB3_ROOM" ]; then
  echo "ERROR: Lab-3 Room not found. Run 20260610-seed-lab3.sh first."
  exit 1
fi
echo "Room: $LAB3_ROOM"

# Rack 생성 (타입별 분리)
create_rack() {
  local RACK_ID=$1
  local RACK_NAME=$2
  local SORT=$3
  local EXISTS=$($DB_CMD -c "SELECT count(*) FROM \"Rack\" WHERE id='$RACK_ID';")
  if [ "$EXISTS" -eq 0 ]; then
    $DB_CMD -c "INSERT INTO \"Rack\" (id, name, \"roomId\", \"sortOrder\", \"totalUnits\", \"updatedAt\")
      VALUES ('$RACK_ID', '$RACK_NAME', '$LAB3_ROOM', $SORT, 42, now());" >/dev/null 2>&1
    echo "  Created rack: $RACK_NAME"
  else
    echo "  Rack exists: $RACK_NAME"
  fi
}

create_rack "rack_lab3_gnrap" "Lab3-GNR-AP" 1
create_rack "rack_lab3_gnrsp" "Lab3-GNR-SP" 2
create_rack "rack_lab3_srf" "Lab3-SRF" 3
create_rack "rack_lab3_spr" "Lab3-SPR" 4

echo ""
echo "=== 2. BMC IP + Rack + 모델 업데이트 ==="

update_server() {
  local HN=$1
  local LAST_OCTET=$2
  local RACK_ID=$3
  local RACK_POS=$4
  local MFR=$5
  local MODEL=$6

  local BMC_IP="192.168.10.${LAST_OCTET}"

  $DB_CMD -c "UPDATE \"Equipment\" SET
    \"bmcIpAddress\" = '$BMC_IP',
    \"rackId\" = '$RACK_ID',
    \"rackPosition\" = $RACK_POS,
    manufacturer = '$MFR',
    model = '$MODEL',
    \"updatedAt\" = now()
    WHERE hostname = '$HN' AND (\"bmcIpAddress\" IS NULL OR \"rackId\" IS NULL);" >/dev/null 2>&1

  local UPDATED=$($DB_CMD -c "SELECT count(*) FROM \"Equipment\" WHERE hostname='$HN' AND \"bmcIpAddress\"='$BMC_IP';")
  if [ "$UPDATED" -gt 0 ]; then
    echo "  OK $HN bmc=$BMC_IP rack=$RACK_ID pos=$RACK_POS"
  else
    echo "  SKIP $HN (not found or already set)"
  fi
}

# GNR-AP 9대
POS=1
for i in $(seq 1 9); do
  NUM=$(printf "%03d" $i)
  update_server "s222hax14ae${NUM}" "$((100+i))" "rack_lab3_gnrap" "$POS" "Supermicro" "GNR-AP"
  POS=$((POS+2))
done

# GNR-SP 10대
POS=1
for i in $(seq 1 10); do
  NUM=$(printf "%03d" $i)
  update_server "s222hx14ae${NUM}" "$((110+i))" "rack_lab3_gnrsp" "$POS" "Supermicro" "GNR-SP"
  POS=$((POS+2))
done

# SRF 4대
POS=1
for i in $(seq 1 4); do
  NUM=$(printf "%03d" $i)
  update_server "g222bx14ae${NUM}" "$((120+i))" "rack_lab3_srf" "$POS" "Supermicro" "SRF"
  POS=$((POS+2))
done

# SPR 1대
update_server "s121x13ae103" "213" "rack_lab3_spr" "1" "Supermicro" "SPR"

echo ""
echo "=== 3. 결과 확인 ==="
$DB_CMD -c "SELECT hostname, \"ipAddress\", \"bmcIpAddress\", manufacturer, model,
  (SELECT name FROM \"Rack\" WHERE id=\"Equipment\".\"rackId\") as rack
  FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' ORDER BY \"ipAddress\";"
