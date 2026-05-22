#!/bin/bash
# s121x13ae013 vs s121x13ae015 메모리 데이터 차이 확인
# 실행: bash check/20260521-memory-compare.sh

DB="docker exec firsttest-db-1 psql -U dcim -d dcim -t -c"

echo "=== 메모리 슬롯 수 ==="
$DB "SELECT e.hostname, COUNT(m.id) as total_slots, SUM(CASE WHEN m.populated THEN 1 ELSE 0 END) as populated FROM \"Equipment\" e LEFT JOIN \"Memory\" m ON m.\"equipmentId\" = e.id WHERE e.hostname IN ('s121x13ae013','s121x13ae015') GROUP BY e.hostname ORDER BY e.hostname;"

echo ""
echo "=== 013 메모리 샘플 (첫 2개) ==="
$DB "SELECT m.\"slotName\", m.populated, m.\"capacityGb\", m.\"memoryType\", m.manufacturer FROM \"Memory\" m JOIN \"Equipment\" e ON m.\"equipmentId\" = e.id WHERE e.hostname = 's121x13ae013' ORDER BY m.\"slotIndex\" LIMIT 2;"

echo ""
echo "=== 015 메모리 샘플 (첫 2개) ==="
$DB "SELECT m.\"slotName\", m.populated, m.\"capacityGb\", m.\"memoryType\", m.manufacturer FROM \"Memory\" m JOIN \"Equipment\" e ON m.\"equipmentId\" = e.id WHERE e.hostname = 's121x13ae015' ORDER BY m.\"slotIndex\" LIMIT 2;"

echo ""
echo "=== BMC IP 확인 ==="
$DB "SELECT hostname, \"bmcIpAddress\" FROM \"Equipment\" WHERE hostname IN ('s121x13ae013','s121x13ae015');"
