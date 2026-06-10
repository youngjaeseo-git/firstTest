#!/bin/bash
# 2026-06-10: Lab-3 서버 추가 정보 업데이트
# Lab-1(10.144.38.100)에서 실행
# 실행: bash check/20260610-update-lab3.sh
#
# 업데이트 내용:
#   - BMC IP (192.168.10.{마지막옥텟})
#   - manufacturer, model 기본값 설정
# 참고: Rack 배치는 사용자가 웹 UI에서 직접 진행

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== 1. BMC IP + 모델 업데이트 ==="

update_server() {
  local HN=$1
  local LAST_OCTET=$2
  local MFR=$3
  local MODEL=$4

  local BMC_IP="192.168.10.${LAST_OCTET}"

  $DB_CMD -c "UPDATE \"Equipment\" SET
    \"bmcIpAddress\" = '$BMC_IP',
    manufacturer = '$MFR',
    model = '$MODEL',
    \"updatedAt\" = now()
    WHERE hostname = '$HN' AND \"bmcIpAddress\" IS NULL;" >/dev/null 2>&1

  local UPDATED=$($DB_CMD -c "SELECT count(*) FROM \"Equipment\" WHERE hostname='$HN' AND \"bmcIpAddress\"='$BMC_IP';")
  if [ "$UPDATED" -gt 0 ]; then
    echo "  OK $HN bmc=$BMC_IP model=$MODEL"
  else
    echo "  SKIP $HN (not found or already set)"
  fi
}

# GNR-AP 9대
for i in $(seq 1 9); do
  NUM=$(printf "%03d" $i)
  update_server "s222hax14ae${NUM}" "$((100+i))" "Supermicro" "GNR-AP"
done

# GNR-SP 10대
for i in $(seq 1 10); do
  NUM=$(printf "%03d" $i)
  update_server "s222hx14ae${NUM}" "$((110+i))" "Supermicro" "GNR-SP"
done

# SRF 4대
for i in $(seq 1 4); do
  NUM=$(printf "%03d" $i)
  update_server "g222bx14ae${NUM}" "$((120+i))" "Supermicro" "SRF"
done

# SPR 1대
update_server "s121x13ae103" "213" "Supermicro" "SPR"

echo ""
echo "=== 2. 결과 확인 ==="
$DB_CMD -c "SELECT hostname, \"ipAddress\", \"bmcIpAddress\", manufacturer, model
  FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' ORDER BY \"ipAddress\";"
