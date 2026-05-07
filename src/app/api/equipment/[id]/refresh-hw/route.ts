import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
  MissingBmcCredentialsError,
} from "@/lib/bmc-credentials";
import { getSystemHwInfo, RedfishError } from "@/lib/redfish";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

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

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: { cpus: true },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    });

    const updateData: Record<string, unknown> = {};
    if (hw.manufacturer) updateData.manufacturer = hw.manufacturer;
    if (hw.model) updateData.model = hw.model;
    if (hw.serialNumber) updateData.serialNumber = hw.serialNumber;
    if (hw.biosVersion) updateData.biosVersion = hw.biosVersion;
    if (hw.totalMemoryGiB) updateData.totalMemoryGB = hw.totalMemoryGiB;

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
