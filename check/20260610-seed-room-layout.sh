#!/bin/bash
# 2026-06-10: Seed room layout geometry (layoutX/Y/W/H) for floor plan
# Prerequisites: npx prisma db push (layoutX/Y/W/H columns must exist)
# Run: bash check/20260610-seed-room-layout.sh

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== Check columns ==="
COL=$($DB_CMD -c "SELECT count(*) FROM information_schema.columns WHERE table_name='Room' AND column_name='layoutX';")
if [ "$COL" = "0" ]; then
  echo "ERROR: layoutX column missing. Run: npx prisma db push"
  exit 1
fi

echo "=== Current layout values ==="
$DB_CMD -c "SELECT name,\"layoutX\",\"layoutY\",\"layoutW\",\"layoutH\" FROM \"Room\" ORDER BY \"sortOrder\";"

echo "=== Update Lab-3 ==="
$DB_CMD -c "UPDATE \"Room\" SET \"layoutX\"=12,\"layoutY\"=12,\"layoutW\"=1376,\"layoutH\"=323 WHERE name ILIKE '%lab%3%';"

echo "=== Update Lab-2 ==="
$DB_CMD -c "UPDATE \"Room\" SET \"layoutX\"=12,\"layoutY\"=345,\"layoutW\"=663,\"layoutH\"=293 WHERE name ILIKE '%lab%2%';"

echo "=== Update Lab-1 ==="
$DB_CMD -c "UPDATE \"Room\" SET \"layoutX\"=685,\"layoutY\"=345,\"layoutW\"=703,\"layoutH\"=293 WHERE name ILIKE '%lab%1%';"

echo "=== Done ==="
$DB_CMD -c "SELECT name,\"layoutX\",\"layoutY\",\"layoutW\",\"layoutH\" FROM \"Room\" ORDER BY \"sortOrder\";"
