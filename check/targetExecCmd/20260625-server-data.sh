#!/bin/bash
# 서버 데이터 정합성 확인: CPU/Memory 누락, biosVersion 이상, BMC 설정 현황
# 실행: bash check/targetExecCmd/20260625-server-data.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then echo "ERR: DB 컨테이너 없음"; exit 1; fi

P="docker exec $DB_CONTAINER psql -U dcim -d dcim -t -A"

echo "=== D1. CPU 데이터 현황 ==="
$P -c "SELECT 'HAS_CPU=' || COUNT(DISTINCT e.id) FROM \"Equipment\" e JOIN \"EquipmentCpu\" c ON c.\"equipmentId\"=e.id WHERE e.type='SERVER';"
$P -c "SELECT 'NO_CPU=' || COUNT(*) FROM \"Equipment\" e WHERE e.type='SERVER' AND NOT EXISTS (SELECT 1 FROM \"EquipmentCpu\" c WHERE c.\"equipmentId\"=e.id);"

echo "=== D2. CPU 없는 서버 (hostname, bmcIp 유무) ==="
$P -c "SELECT LEFT(e.hostname,20) || '|' || COALESCE(LEFT(e.\"bmcIpAddress\",15),'NO_BMC') FROM \"Equipment\" e WHERE e.type='SERVER' AND NOT EXISTS (SELECT 1 FROM \"EquipmentCpu\" c WHERE c.\"equipmentId\"=e.id) ORDER BY e.hostname LIMIT 15;"

echo "=== D3. Memory 데이터 현황 ==="
$P -c "SELECT 'HAS_MEM=' || COUNT(*) FROM \"Equipment\" WHERE type='SERVER' AND \"totalMemoryGB\" IS NOT NULL AND \"totalMemoryGB\">0;"
$P -c "SELECT 'NO_MEM=' || COUNT(*) FROM \"Equipment\" WHERE type='SERVER' AND (\"totalMemoryGB\" IS NULL OR \"totalMemoryGB\"=0);"

echo "=== D4. biosVersion 분류 ==="
$P -c "SELECT CASE WHEN \"biosVersion\" IS NULL THEN 'NULL' WHEN \"biosVersion\" LIKE 'kernel %' THEN 'KERNEL' WHEN \"biosVersion\"='1.0' THEN 'V1.0' ELSE 'REAL_BIOS' END AS typ, COUNT(*) FROM \"Equipment\" WHERE type='SERVER' GROUP BY typ ORDER BY typ;"

echo "=== D5. biosVersion 샘플 (타입별 1개) ==="
$P -c "SELECT LEFT(hostname,15) || '|' || LEFT(\"biosVersion\",30) FROM \"Equipment\" WHERE type='SERVER' AND \"biosVersion\" LIKE 'kernel %' LIMIT 1;"
$P -c "SELECT LEFT(hostname,15) || '|' || LEFT(\"biosVersion\",30) FROM \"Equipment\" WHERE type='SERVER' AND \"biosVersion\"='1.0' LIMIT 1;"
$P -c "SELECT LEFT(hostname,15) || '|' || LEFT(\"biosVersion\",30) FROM \"Equipment\" WHERE type='SERVER' AND \"biosVersion\" IS NOT NULL AND \"biosVersion\" NOT LIKE 'kernel %' AND \"biosVersion\"!='1.0' LIMIT 1;"

echo "=== D6. BMC IP 설정 현황 ==="
$P -c "SELECT 'HAS_BMC=' || COUNT(*) FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NOT NULL;"
$P -c "SELECT 'NO_BMC=' || COUNT(*) FROM \"Equipment\" WHERE type='SERVER' AND \"bmcIpAddress\" IS NULL;"

echo "=== 완료 ==="
