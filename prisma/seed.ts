import { PrismaClient, EquipmentType, EquipmentStatus, MemoryType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@dcim.local" },
    update: {},
    create: {
      email: "admin@dcim.local",
      name: "Administrator",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const operatorPassword = await hash("operator123", 12);
  await prisma.user.upsert({
    where: { email: "operator@dcim.local" },
    update: {},
    create: {
      email: "operator@dcim.local",
      name: "Operator",
      password: operatorPassword,
      role: "OPERATOR",
    },
  });

  // 2. Create DataCenter
  const dc = await prisma.dataCenter.upsert({
    where: { id: "dc-main" },
    update: {},
    create: {
      id: "dc-main",
      name: "Main Data Center",
      location: "Seoul, Korea",
      description: "메인 데이터센터",
    },
  });

  // 3. Create Rooms
  const roomA = await prisma.room.upsert({
    where: { id: "room-a" },
    update: {},
    create: {
      id: "room-a",
      name: "Server Room A",
      sortOrder: 0,
      dataCenterId: dc.id,
      description: "주 서버룸 - GPU 및 컴퓨트 서버",
    },
  });

  const roomB = await prisma.room.upsert({
    where: { id: "room-b" },
    update: {},
    create: {
      id: "room-b",
      name: "Server Room B",
      sortOrder: 1,
      dataCenterId: dc.id,
      description: "보조 서버룸 - 스토리지 및 네트워크",
    },
  });

  // 4. Create Racks
  const racks: { id: string; name: string; roomId: string; rowLabel: string; sortOrder: number }[] = [];
  const rackDefs = [
    { room: roomA.id, row: "A", count: 4 },
    { room: roomA.id, row: "B", count: 3 },
    { room: roomB.id, row: "A", count: 3 },
    { room: roomB.id, row: "B", count: 2 },
  ];

  for (const def of rackDefs) {
    for (let i = 1; i <= def.count; i++) {
      const id = `rack-${def.row.toLowerCase()}-${def.room === roomA.id ? "a" : "b"}-${String(i).padStart(2, "0")}`;
      const rack = await prisma.rack.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: `${def.row}${String(i).padStart(2, "0")}`,
          roomId: def.room,
          rowLabel: def.row,
          sortOrder: i - 1,
          totalUnits: 42,
          positionX: (i - 1) * 2,
          positionY: def.row === "A" ? 0 : 2,
        },
      });
      racks.push({ ...rack, rowLabel: def.row });
    }
  }

  // 5. Create Equipment with CPU and Memory
  const serverModels = [
    { manufacturer: "Dell", model: "PowerEdge R750", height: 2, generation: "SPR" },
    { manufacturer: "Dell", model: "PowerEdge R760", height: 2, generation: "EMR" },
    { manufacturer: "HPE", model: "ProLiant DL380 Gen11", height: 2, generation: "GNR" },
    { manufacturer: "Supermicro", model: "SYS-420GP-TNR", height: 4, generation: "SPR" },
    { manufacturer: "Lenovo", model: "ThinkSystem SR650 V3", height: 2, generation: "GNR" },
    { manufacturer: "Dell", model: "PowerEdge R960", height: 4, generation: "GNR" },
    { manufacturer: "HPE", model: "ProLiant DL360 Gen11", height: 1, generation: "EMR" },
    { manufacturer: "Supermicro", model: "AS-4125GS-TNRT2", height: 4, generation: "TURIN" },
  ];

  const cpuModels = [
    { manufacturer: "Intel", model: "Xeon Gold 6438Y+ (SPR)", cores: 32, threads: 64, baseFreqMhz: 2000, maxFreqMhz: 4000, tdpWatts: 205, arch: "x86_64" },
    { manufacturer: "Intel", model: "Xeon Gold 6548Y+ (EMR)", cores: 32, threads: 64, baseFreqMhz: 2500, maxFreqMhz: 4100, tdpWatts: 250, arch: "x86_64" },
    { manufacturer: "Intel", model: "Xeon w9-3595X (GNR)", cores: 60, threads: 120, baseFreqMhz: 2000, maxFreqMhz: 4800, tdpWatts: 385, arch: "x86_64" },
    { manufacturer: "AMD", model: "EPYC 9454 (GENOA)", cores: 48, threads: 96, baseFreqMhz: 2750, maxFreqMhz: 3800, tdpWatts: 290, arch: "x86_64" },
    { manufacturer: "AMD", model: "EPYC 9554 (TURIN)", cores: 64, threads: 128, baseFreqMhz: 3100, maxFreqMhz: 3750, tdpWatts: 360, arch: "x86_64" },
  ];

  const memoryManufacturers = ["Samsung", "SK Hynix", "Micron"];

  let serverIndex = 0;
  for (const rack of racks.slice(0, 8)) {
    // Put 3-5 servers per rack
    const serverCount = 3 + Math.floor(Math.random() * 3);
    let currentU = 1;

    for (let s = 0; s < serverCount && currentU <= 38; s++) {
      serverIndex++;
      const sModel = serverModels[serverIndex % serverModels.length];
      const cpuModel = cpuModels[serverIndex % cpuModels.length];
      const status: EquipmentStatus =
        serverIndex % 15 === 0
          ? "REPAIR"
          : serverIndex % 12 === 0
            ? "MAINTENANCE"
            : serverIndex % 20 === 0
              ? "FAILED"
              : "ACTIVE";

      const eqId = `server-${String(serverIndex).padStart(3, "0")}`;
      const hostname = `svr-${rack.rowLabel?.toLowerCase() || "x"}${String(serverIndex).padStart(3, "0")}`;
      const ip = `10.144.${38 + Math.floor(serverIndex / 256)}.${(serverIndex % 256) + 1}`;
      const bmcIp = `10.144.${100 + Math.floor(serverIndex / 256)}.${(serverIndex % 256) + 1}`;

      const eq = await prisma.equipment.upsert({
        where: { id: eqId },
        update: {},
        create: {
          id: eqId,
          hostname,
          ipAddress: ip,
          type: EquipmentType.SERVER,
          manufacturer: sModel.manufacturer,
          model: sModel.model,
          serialNumber: `SN${String(serverIndex).padStart(8, "0")}`,
          assetTag: `ASSET-${String(serverIndex).padStart(6, "0")}`,
          rackId: rack.id,
          rackPosition: currentU,
          rackHeight: sModel.height,
          status,
          osType: "Linux",
          osVersion: serverIndex % 3 === 0 ? "Rocky Linux 9.3" : serverIndex % 3 === 1 ? "Ubuntu 22.04 LTS" : "RHEL 8.9",
          biosVersion: `${sModel.manufacturer === "Dell" ? "2.19.1" : sModel.manufacturer === "HPE" ? "U46 v3.10" : "3.6a"}`,
          bmcIpAddress: bmcIp,
          totalMemoryGB: serverIndex % 4 === 0 ? 256 : serverIndex % 4 === 1 ? 512 : serverIndex % 4 === 2 ? 1024 : 768,
          prometheusInstance: `${ip}:9100`,
        },
      });

      // Create 2 CPUs per server
      for (let sock = 0; sock < 2; sock++) {
        await prisma.equipmentCpu.upsert({
          where: {
            equipmentId_socketIndex: {
              equipmentId: eq.id,
              socketIndex: sock,
            },
          },
          update: {},
          create: {
            equipmentId: eq.id,
            socketIndex: sock,
            manufacturer: cpuModel.manufacturer,
            model: cpuModel.model,
            cores: cpuModel.cores,
            threads: cpuModel.threads,
            baseFreqMhz: cpuModel.baseFreqMhz,
            maxFreqMhz: cpuModel.maxFreqMhz,
            architecture: cpuModel.arch || "x86_64",
            tdpWatts: cpuModel.tdpWatts,
          },
        });
      }

      // Create 16 DIMM slots (8 per CPU)
      for (let slot = 0; slot < 16; slot++) {
        const cpuNum = slot < 8 ? 0 : 1;
        const chNum = slot % 8;
        const populated = slot < 12; // 12 of 16 populated
        const mfr = memoryManufacturers[slot % 3];

        await prisma.equipmentMemory.upsert({
          where: {
            equipmentId_slotIndex: {
              equipmentId: eq.id,
              slotIndex: slot,
            },
          },
          update: {},
          create: {
            equipmentId: eq.id,
            slotName: `CPU${cpuNum}_CH${chNum}_DIMM0`,
            slotIndex: slot,
            populated,
            capacityGb: populated ? 32 : null,
            memoryType: populated ? MemoryType.DDR5 : null,
            manufacturer: populated ? mfr : null,
            partNumber: populated ? `M393A4G43BB4-CWE${slot}` : null,
            serialNumber: populated ? `${mfr.substring(0, 2).toUpperCase()}${String(serverIndex * 100 + slot).padStart(10, "0")}` : null,
            speedMhz: populated ? 4800 : null,
            currentSpeedMhz: populated ? 4800 : null,
            rank: populated ? 2 : null,
            eccEnabled: populated ? true : null,
            formFactor: populated ? "RDIMM" : null,
            voltage: populated ? 1.1 : null,
          },
        });
      }

      currentU += sModel.height + 1; // +1 for spacing
    }
  }

  // 6. Create sample alerts
  const alertDefs = [
    { severity: "CRITICAL", summary: "CPU temperature exceeds 90°C", source: "svr-a001", category: "temperature" },
    { severity: "WARNING", summary: "Disk usage above 85%", source: "svr-a003", category: "disk" },
    { severity: "WARNING", summary: "Memory usage above 90%", source: "svr-b005", category: "memory" },
    { severity: "INFO", summary: "Scheduled maintenance window starting", source: "rack-a-a-01", category: "maintenance" },
    { severity: "WARNING", summary: "Network packet loss detected (>1%)", source: "svr-a007", category: "network" },
    { severity: "CRITICAL", summary: "Server unreachable", source: "svr-b010", category: "availability" },
    { severity: "WARNING", summary: "PCIe bandwidth degraded", source: "svr-a012", category: "hardware" },
    { severity: "INFO", summary: "DIMM error corrected (ECC)", source: "svr-a002", category: "memory" },
  ];

  for (let i = 0; i < alertDefs.length; i++) {
    const def = alertDefs[i];
    const daysAgo = Math.floor(i / 3);
    const firedAt = new Date();
    firedAt.setDate(firedAt.getDate() - daysAgo);
    firedAt.setHours(10 + i, 30, 0);

    await prisma.alert.create({
      data: {
        severity: def.severity as "CRITICAL" | "WARNING" | "INFO",
        summary: def.summary,
        source: def.source,
        category: def.category,
        status: i < 3 ? "FIRING" : i < 5 ? "ACKNOWLEDGED" : "RESOLVED",
        firedAt,
        resolvedAt: i >= 5 ? new Date() : null,
      },
    });
  }

  console.log(`Seeded: 2 users, 1 DC, 2 rooms, ${racks.length} racks, ${serverIndex} servers, ${alertDefs.length} alerts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
