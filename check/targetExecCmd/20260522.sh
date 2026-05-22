#!/bin/bash
# 2026-05-22 실행 스크립트
# 실행: bash check/targetExecCmd/20260522.sh

DB="docker exec firsttest-db-1 psql -U dcim -d dcim -t -c"

echo "=== 1. 서버별 메모리 슬롯 수 ==="
$DB "SELECT e.hostname, COUNT(m.id) as slots FROM \"Equipment\" e LEFT JOIN \"EquipmentMemory\" m ON m.\"equipmentId\" = e.id WHERE e.type = 'SERVER' GROUP BY e.hostname ORDER BY e.hostname;"

echo ""
echo "=== 2. 013 장비 등록일 / 수정일 ==="
$DB "SELECT hostname, \"createdAt\", \"updatedAt\" FROM \"Equipment\" WHERE hostname = 's121x13ae013';"

echo ""
echo "=== 3. 015 장비 등록일 / 수정일 ==="
$DB "SELECT hostname, \"createdAt\", \"updatedAt\" FROM \"Equipment\" WHERE hostname = 's121x13ae015';"

echo ""
echo "=== 4. HW Refresh 이력 (최근 10건) ==="
$DB "SELECT e.hostname, a.action, a.\"createdAt\" FROM \"AuditLog\" a JOIN \"Equipment\" e ON a.\"entityId\" = e.id WHERE a.action LIKE '%REFRESH%' OR a.action LIKE '%refresh%' ORDER BY a.\"createdAt\" DESC LIMIT 10;"

echo ""
echo "=== 5. 013 관련 모든 AuditLog ==="
$DB "SELECT a.action, a.\"createdAt\" FROM \"AuditLog\" a JOIN \"Equipment\" e ON a.\"entityId\" = e.id WHERE e.hostname = 's121x13ae013' ORDER BY a.\"createdAt\" DESC LIMIT 5;"
