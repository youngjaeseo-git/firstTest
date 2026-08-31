#!/bin/bash
# 2026-06-10: Seed initial room elements for floor plan drag editing
# Prerequisites: npx prisma db push (RoomElement table must exist)
# Run: bash check/20260610-seed-room-elements.sh

DB_CMD="docker exec firsttest-db-1 psql -U dcim -d dcim -t -A"

echo "=== Check table ==="
TE=$($DB_CMD -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='RoomElement');")
if [ "$TE" != "t" ]; then
  echo "ERROR: RoomElement table missing. Run: npx prisma db push"
  exit 1
fi

EC=$($DB_CMD -c "SELECT count(*) FROM \"RoomElement\";")
echo "Existing: $EC"
if [ "$EC" -gt "0" ]; then
  echo "Already seeded. Skip."
  exit 0
fi

L3=$($DB_CMD -c "SELECT r.id FROM \"Room\" r LEFT JOIN \"Rack\" rk ON rk.\"roomId\"=r.id WHERE r.name ILIKE '%lab%3%' GROUP BY r.id ORDER BY count(rk.id) DESC LIMIT 1;")
L1=$($DB_CMD -c "SELECT r.id FROM \"Room\" r LEFT JOIN \"Rack\" rk ON rk.\"roomId\"=r.id WHERE r.name ILIKE '%lab%1%' GROUP BY r.id ORDER BY count(rk.id) DESC LIMIT 1;")

echo "Lab-3=$L3 Lab-1=$L1"
if [ -z "$L3" ] || [ -z "$L1" ]; then echo "ERROR: Room not found"; exit 1; fi

echo "=== Seed Lab-3 ==="
$DB_CMD -c "INSERT INTO \"RoomElement\" (id,\"roomId\",type,name,\"positionX\",\"positionY\",width,height,metadata,\"sortOrder\",\"createdAt\",\"updatedAt\") VALUES
('el-l3-sw1','$L3','SWITCH','NET SWITCH',828,80,90,40,'{\"subLabel\":\"ToR / Spine\"}',1,NOW(),NOW()),
('el-l3-ms1','$L3','MASTER_SERVER','K8s Master',828,132,100,36,'{\"hostname\":\"master-lab3\"}',2,NOW(),NOW()),
('el-l3-ac1','$L3','COOLING','AC-1',757,271,72,32,'{\"airflowDirection\":\"up\",\"airflowLength\":45}',3,NOW(),NOW()),
('el-l3-ac2','$L3','COOLING','AC-2',847,271,72,32,'{\"airflowDirection\":\"up\",\"airflowLength\":45}',4,NOW(),NOW()),
('el-l3-ac3','$L3','COOLING','AC-3',937,271,72,32,'{\"airflowDirection\":\"up\",\"airflowLength\":45}',5,NOW(),NOW()),
('el-l3-pdu','$L3','PDU','PDU',1316,271,44,34,'{\"subLabel\":\"3-Phase\"}',6,NOW(),NOW());"

echo "=== Seed Lab-1 ==="
$DB_CMD -c "INSERT INTO \"RoomElement\" (id,\"roomId\",type,name,\"positionX\",\"positionY\",width,height,metadata,\"sortOrder\",\"createdAt\",\"updatedAt\") VALUES
('el-l1-ac1','$L1','COOLING','AC-1',601,36,72,32,'{\"airflowDirection\":\"up\",\"airflowLength\":30}',1,NOW(),NOW()),
('el-l1-sw1','$L1','SWITCH','NET SWITCH',30,72,90,40,'{\"subLabel\":\"ToR / Spine\"}',2,NOW(),NOW()),
('el-l1-pdu','$L1','PDU','PDU',30,132,44,34,'{\"subLabel\":\"3-Phase\"}',3,NOW(),NOW()),
('el-l1-ms1','$L1','MASTER_SERVER','K8s Master',30,192,100,36,'{\"hostname\":\"k8-master\",\"role\":\"DCIM\"}',4,NOW(),NOW());"

echo "=== Done ==="
$DB_CMD -c "SELECT type,name,\"positionX\",\"positionY\" FROM \"RoomElement\" ORDER BY \"roomId\",\"sortOrder\";"
