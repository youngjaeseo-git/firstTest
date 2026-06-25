#!/bin/bash
# 전체 서버 Bulk HW Refresh (앱 컨테이너에서 직접 Redfish 호출)
# 실행: bash check/targetExecCmd/20260625-bulk-refresh.sh
# 소요시간: 서버당 5~15초, 30대 기준 3~8분
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

APP_CONTAINER=$(docker compose ps -q app 2>/dev/null)
if [ -z "$APP_CONTAINER" ]; then echo "ERR: app 컨테이너 없음"; exit 1; fi

echo "=== Bulk HW Refresh 시작 ==="
docker exec "$APP_CONTAINER" npx tsx -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const servers = await prisma.equipment.findMany({
    where: { type: "SERVER", bmcIpAddress: { not: null } },
    select: { id: true, hostname: true, bmcIpAddress: true },
    orderBy: { hostname: "asc" },
  });
  console.log("TOTAL=" + servers.length);

  const user = process.env.BMC_USERNAME;
  const pass = process.env.BMC_PASSWORD;
  if (!user || !pass) { console.log("ERR: BMC_USERNAME/BMC_PASSWORD 미설정"); return; }

  const { getSystemHwInfo } = require("./src/lib/redfish");
  let ok = 0, fail = 0;

  for (const s of servers) {
    try {
      const hw = await getSystemHwInfo({
        host: s.bmcIpAddress,
        username: user,
        password: pass,
        timeoutMs: 15000,
      });

      const upd = {};
      if (hw.manufacturer) upd.manufacturer = hw.manufacturer;
      if (hw.model) upd.model = hw.model;
      if (hw.serialNumber) upd.serialNumber = hw.serialNumber;
      if (hw.biosVersion) upd.biosVersion = hw.biosVersion;
      if (hw.totalMemoryGiB) upd.totalMemoryGB = hw.totalMemoryGiB;
      if (Object.keys(upd).length > 0) {
        await prisma.equipment.update({ where: { id: s.id }, data: upd });
      }

      if (hw.cpus.length > 0) {
        await prisma.equipmentCpu.deleteMany({ where: { equipmentId: s.id } });
        await prisma.equipmentCpu.createMany({
          data: hw.cpus.map((c, i) => ({
            equipmentId: s.id, socketIndex: i,
            manufacturer: c.manufacturer, model: c.model,
            cores: c.cores, threads: c.threads,
            maxFreqMhz: c.maxSpeedMhz, tdpWatts: c.tdpWatts,
            architecture: c.architecture,
          })),
        });
      }

      if (hw.memories.length > 0) {
        await prisma.equipmentMemory.deleteMany({ where: { equipmentId: s.id } });
        const typeMap = { DDR4: "DDR4", DDR5: "DDR5", LPDDR4: "LPDDR4", LPDDR5: "LPDDR5", HBM: "HBM", HBM2: "HBM2", HBM2E: "HBM2E", HBM3: "HBM3", DDR3: "DDR3" };
        await prisma.equipmentMemory.createMany({
          data: hw.memories.map((m, i) => ({
            equipmentId: s.id,
            slotName: m.slotName || "DIMM_" + i,
            slotIndex: i, populated: m.populated,
            capacityGb: m.capacityGb,
            memoryType: typeMap[m.memoryType] || null,
            manufacturer: m.manufacturer, partNumber: m.partNumber,
            serialNumber: m.serialNumber, speedMhz: m.speedMhz,
            currentSpeedMhz: m.currentSpeedMhz, rank: m.rank,
            eccEnabled: m.eccEnabled, formFactor: m.formFactor,
            voltage: m.voltage,
          })),
        });
      }

      ok++;
      process.stdout.write("OK:" + (s.hostname || "?").substring(0,20) + " ");
    } catch (e) {
      fail++;
      process.stdout.write("FAIL:" + (s.hostname || "?").substring(0,15) + " ");
    }
  }

  console.log("");
  console.log("DONE OK=" + ok + " FAIL=" + fail);

  const cpuC = await prisma.equipmentCpu.groupBy({ by: ["equipmentId"], _count: true });
  const memC = await prisma.equipment.count({ where: { type: "SERVER", totalMemoryGB: { gt: 0 } } });
  const biosC = await prisma.equipment.count({ where: { type: "SERVER", biosVersion: { not: null } } });
  console.log("AFTER CPU=" + cpuC.length + " MEM=" + memC + " BIOS=" + biosC);

  await prisma.$disconnect();
}
main().catch(e => { console.log("ERR:", e.message); process.exit(1); });
'

echo "=== 완료 ==="
