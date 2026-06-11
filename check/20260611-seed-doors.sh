#!/bin/bash
# 2026-06-11: Seed door elements for floor plan drag editing
# Prerequisites: RoomElement table must exist
# Run: bash check/20260611-seed-doors.sh

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== Check existing doors ==="
DC=$($DB_CMD -c "SELECT count(*) FROM \"RoomElement\" WHERE type='DOOR';")
echo "Existing doors: $DC"
if [ "$DC" -gt "0" ]; then
  echo "Already seeded. Skip."
  exit 0
fi

L3=$($DB_CMD -c "SELECT r.id FROM \"Room\" r WHERE r.name ILIKE '%lab%3%' LIMIT 1;")
L2=$($DB_CMD -c "SELECT r.id FROM \"Room\" r WHERE r.name ILIKE '%lab%2%' LIMIT 1;")
echo "Lab-3=$L3 Lab-2=$L2"
if [ -z "$L3" ]; then echo "ERROR: Lab-3 not found"; exit 1; fi

echo "=== Seed doors ==="
$DB_CMD -c "INSERT INTO \"RoomElement\" (id,\"roomId\",type,name,\"positionX\",\"positionY\",width,height,metadata,\"sortOrder\",\"createdAt\",\"updatedAt\") VALUES
('el-door-top','$L3','DOOR','DOOR',688,0,40,4,'{\"orientation\":\"horizontal\"}',90,NOW(),NOW()),
('el-door-mid','$L3','DOOR','DOOR',668,323,40,4,'{\"orientation\":\"horizontal\"}',91,NOW(),NOW()),
('el-door-side','${L2:-$L3}','DOOR','DOOR',668,155,4,40,'{\"orientation\":\"vertical\"}',92,NOW(),NOW());"

echo "=== Done ==="
$DB_CMD -c "SELECT type,name,\"positionX\",\"positionY\" FROM \"RoomElement\" WHERE type='DOOR' ORDER BY \"sortOrder\";"
