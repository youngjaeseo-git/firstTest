import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
  MissingBmcCredentialsError,
} from "@/lib/bmc-credentials";
import { getSystemHwInfo, RedfishError } from "@/lib/redfish";
import { logAudit } from "@/lib/audit";
import { MemoryType } from "@prisma/client";

export const dynamic = "force-dynamic";

const MEMORY_TYPE_MAP: Record<string, string> = {
  DDR3: "DDR3",
  DDR4: "DDR4",
  DDR5: "DDR5",
  HBM: "HBM",
  HBM2: "HBM2",
  HBM2E: "HBM2E",
  HBM3: "HBM3",
  LPDDR4: "LPDDR4",
  LPDDR5: "LPDDR5",
};

function mapMemoryType(redfishType: string | null): MemoryType | null {
  if (!redfishType) return null;
  const upper = redfishType.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [key, val] of Object.entries(MEMORY_TYPE_MAP)) {
    if (upper.includes(key)) return val as MemoryType;
  }
  return null;
}

/**
 * POST /api/equipment/[id]/refresh-hw
 * Refresh hardware info from Redfish (BMC).
 * Updates manufacturer, model, serialNumber, biosVersion, memory, CPUs.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: { cpus: true, rack: { include: { room: { select: { bmcProxyUrl: true } } } } },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Org-based access check
  if (
    user.role !== "ADMIN" &&
    (!equipment.organizationId || !user.orgIds.includes(equipment.organizationId))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!equipment.bmcIpAddress) {
    return NextResponse.json(
      { error: "No BMC IP configured" },
      { status: 400 },
    );
  }
  if (!bmcCredentialsConfigured()) {
    return NextResponse.json(
      { error: "BMC credentials not configured in .env" },
      { status: 503 },
    );
  }

  let creds;
  try {
    creds = getBmcCredentials(equipment);
  } catch (err) {
    if (err instanceof MissingBmcCredentialsError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  try {
    const hw = await getSystemHwInfo({
      host: equipment.bmcIpAddress,
      username: creds.username,
      password: creds.password,
      timeoutMs: 15_000,
      proxyUrl: equipment.rack?.room?.bmcProxyUrl ?? undefined,
    });

    const updateData: Record<string, unknown> = {};
    if (hw.manufacturer) updateData.manufacturer = hw.manufacturer;
    if (hw.model) updateData.model = hw.model;
    if (hw.serialNumber) updateData.serialNumber = hw.serialNumber;
    if (hw.biosVersion) updateData.biosVersion = hw.biosVersion;
    if (hw.totalMemoryGiB) updateData.totalMemoryGB = Math.round(hw.totalMemoryGiB);

    await prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    if (hw.cpus.length > 0) {
      await prisma.equipmentCpu.deleteMany({ where: { equipmentId: id } });
      await prisma.equipmentCpu.createMany({
        data: hw.cpus.map((cpu, i) => ({
          equipmentId: id,
          socketIndex: i,
          manufacturer: cpu.manufacturer,
          model: cpu.model,
          cores: cpu.cores,
          threads: cpu.threads,
          maxFreqMhz: cpu.maxSpeedMhz,
          tdpWatts: cpu.tdpWatts,
          architecture: cpu.architecture,
        })),
      });
    }

    if (hw.memories.length > 0) {
      await prisma.equipmentMemory.deleteMany({ where: { equipmentId: id } });
      await prisma.equipmentMemory.createMany({
        data: hw.memories.map((mem, i) => ({
          equipmentId: id,
          slotName: mem.slotName || `DIMM_${i}`,
          slotIndex: i,
          populated: mem.populated,
          capacityGb: mem.capacityGb,
          memoryType: mapMemoryType(mem.memoryType),
          manufacturer: mem.manufacturer,
          partNumber: mem.partNumber,
          serialNumber: mem.serialNumber,
          speedMhz: mem.speedMhz,
          currentSpeedMhz: mem.currentSpeedMhz,
          rank: mem.rank,
          eccEnabled: mem.eccEnabled,
          formFactor: mem.formFactor,
          voltage: mem.voltage,
        })),
      });
    }

    if (hw.networkInterfaces.length > 0) {
      await prisma.networkPort.deleteMany({ where: { equipmentId: id } });
      await prisma.networkPort.createMany({
        data: hw.networkInterfaces.map((nic) => ({
          equipmentId: id,
          name: nic.name || "Unknown",
          speed: nic.speedMbps
            ? nic.speedMbps >= 1000
              ? `${nic.speedMbps / 1000}G`
              : `${nic.speedMbps}M`
            : null,
          connected: nic.linkStatus === "LinkUp",
        })),
      });
    }

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "Equipment",
      entityId: id,
      changes: {
        source: "Redfish",
        manufacturer: hw.manufacturer,
        model: hw.model,
        cpuCount: hw.cpus.length,
        totalMemoryGiB: hw.totalMemoryGiB,
        dimmSlots: hw.memories.length,
        dimmPopulated: hw.memories.filter((m) => m.populated).length,
        nicCount: hw.networkInterfaces.length,
      },
      reason: "Hardware info refreshed from BMC",
    });

    return NextResponse.json({
      success: true,
      hw: {
        manufacturer: hw.manufacturer,
        model: hw.model,
        serialNumber: hw.serialNumber,
        biosVersion: hw.biosVersion,
        totalMemoryGiB: hw.totalMemoryGiB,
        cpuCount: hw.cpus.length,
        cpus: hw.cpus,
        dimmSlots: hw.memories.length,
        dimmPopulated: hw.memories.filter((m) => m.populated).length,
        nicCount: hw.networkInterfaces.length,
      },
    });
  } catch (err) {
    const message =
      err instanceof RedfishError
        ? err.message
        : "Failed to fetch HW info from BMC";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
