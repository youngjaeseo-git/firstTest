#!/bin/bash
# 2026-06-10: Lab-3 서버 BMC IP 제거 + 잘못된 모델 정보 초기화
# Lab-1(10.144.38.100)에서 실행
# 실행: bash check/20260610-fix-lab3-bmc.sh
#
# 문제: Lab-1/Lab-3 BMC가 같은 192.168.10.x 대역이라 충돌
# DCIM이 Lab-1 BMC 스위치만 접근 가능 → Lab-3 BMC IP로 조회하면 Lab-1 서버 HW 정보를 가져옴

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== 1. 현재 Lab-3 서버 BMC IP 상태 ==="
$DB_CMD -c "SELECT count(*) || ' servers with BMC IP' FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' AND \"bmcIpAddress\" IS NOT NULL;"

echo ""
echo "=== 2. Lab-3 BMC IP 제거 + 잘못된 HW 정보 초기화 ==="
$DB_CMD -c "UPDATE \"Equipment\" SET
  \"bmcIpAddress\" = NULL,
  \"updatedAt\" = now()
  WHERE \"ipAddress\" LIKE '10.144.131.%' AND \"bmcIpAddress\" IS NOT NULL;"

# 시드 스크립트로 넣은 manufacturer/model은 유지하고, Redfish에서 잘못 가져온 정보만 리셋
# SYS-121H-TNR 같은 Redfish 모델은 Lab-1 서버의 것이므로 제거
$DB_CMD -c "UPDATE \"Equipment\" SET
  model = CASE
    WHEN hostname LIKE 's222hax14ae%' THEN 'GNR-AP'
    WHEN hostname LIKE 's222hx14ae%' THEN 'GNR-SP'
    WHEN hostname LIKE 'g222bx14ae%' THEN 'SRF'
    WHEN hostname = 's121x13ae103' THEN 'SPR'
    ELSE model
  END,
  manufacturer = 'Supermicro',
  \"updatedAt\" = now()
  WHERE \"ipAddress\" LIKE '10.144.131.%';"

# Redfish에서 잘못 가져온 CPU 정보도 제거
$DB_CMD -c "DELETE FROM \"EquipmentCpu\" WHERE \"equipmentId\" IN
  (SELECT id FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%');"

# Redfish에서 잘못 가져온 메모리 정보도 제거
$DB_CMD -c "DELETE FROM \"EquipmentMemory\" WHERE \"equipmentId\" IN
  (SELECT id FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%');"

echo ""
echo "=== 3. 결과 확인 ==="
$DB_CMD -c "SELECT hostname, \"ipAddress\", \"bmcIpAddress\", manufacturer, model
  FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%' ORDER BY \"ipAddress\";"
echo ""
CPUCOUNT=$($DB_CMD -c "SELECT count(*) FROM \"EquipmentCpu\" WHERE \"equipmentId\" IN (SELECT id FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%');")
MEMCOUNT=$($DB_CMD -c "SELECT count(*) FROM \"EquipmentMemory\" WHERE \"equipmentId\" IN (SELECT id FROM \"Equipment\" WHERE \"ipAddress\" LIKE '10.144.131.%');")
echo "Lab-3 CPU records: $CPUCOUNT, Memory records: $MEMCOUNT"
