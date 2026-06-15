import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canControlPower, canEdit } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
  MissingBmcCredentialsError,
} from "@/lib/bmc-credentials";
import {
  getSystemHwInfo,
  getPowerState,
  resetSystem,
  RedfishError,
  type ResetType,
  type SystemHwInfo,
} from "@/lib/redfish";
import { logAudit } from "@/lib/audit";
import { MemoryType } from "@prisma/client";

export const dynamic = "force-dynamic";

const MEMORY_TYPE_MAP: Record<string, string> = {
  DDR3: "DDR3", DDR4: "DDR4", DDR5: "DDR5",
  HBM: "HBM", HBM2: "HBM2", HBM2E: "HBM2E", HBM3: "HBM3",
  LPDDR4: "LPDDR4", LPDDR5: "LPDDR5",
};

function mapMemoryType(redfishType: string | null): MemoryType | null {
  if (!redfishType) return null;
  const upper = redfishType.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [key, val] of Object.entries(MEMORY_TYPE_MAP)) {
    if (upper.includes(key)) return val as MemoryType;
  }
  return null;
}

const BulkRefreshSchema = z.object({
  action: z.literal("refresh-hw"),
  equipmentIds: z.array(z.string()).min(1).max(50),
});

const BulkPowerSchema = z.object({
  action: z.literal("power"),
  equipmentIds: z.array(z.string()).min(1).max(50),
  resetType: z.enum([
    "On", "ForceOn", "ForceOff", "GracefulShutdown",
    "GracefulRestart", "ForceRestart", "Nmi", "PowerCycle",
  ]),
  reason: z.string().trim().min(3).max(500),
});

const BulkStatusSchema = z.object({
  action: z.literal("power-status"),
  equipmentIds: z.array(z.string()).min(1).max(100),
});

const BulkSchema = z.discriminatedUnion("action", [
  BulkRefreshSchema,
  BulkPowerSchema,
  BulkStatusSchema,
]);

interface ResultItem {
  equipmentId: string;
  hostname: string | null;
  bmcIp: string | null;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

async function saveHwInfo(equipmentId: string, hw: SystemHwInfo) {
  const updateData: Record<string, unknown> = {};
  if (hw.manufacturer) updateData.manufacturer = hw.manufacturer;
  if (hw.model) updateData.model = hw.model;
  if (hw.serialNumber) updateData.serialNumber = hw.serialNumber;
  if (hw.biosVersion) updateData.biosVersion = hw.biosVersion;
  if (hw.totalMemoryGiB) updateData.totalMemoryGB = hw.totalMemoryGiB;

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: updateData,
  });

  if (hw.cpus.length > 0) {
    await prisma.equipmentCpu.deleteMany({ where: { equipmentId } });
    await prisma.equipmentCpu.createMany({
      data: hw.cpus.map((cpu, i) => ({
        equipmentId,
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
    await prisma.equipmentMemory.deleteMany({ where: { equipmentId } });
    await prisma.equipmentMemory.createMany({
      data: hw.memories.map((mem, i) => ({
        equipmentId,
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
    await prisma.networkPort.deleteMany({ where: { equipmentId } });
    await prisma.networkPort.createMany({
      data: hw.networkInterfaces.map((nic) => ({
        equipmentId,
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
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, BulkSchema);
  if (parsed.response) return parsed.response;
  const payload = parsed.data;

  if (payload.action === "power" && !canControlPower(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN or OPERATOR required" },
      { status: 403 },
    );
  }

  // refresh-hw deletes+rewrites CPU/memory/NIC rows, so it requires edit rights
  if (payload.action === "refresh-hw" && !canEdit(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN or OPERATOR required" },
      { status: 403 },
    );
  }

  if (!bmcCredentialsConfigured()) {
    return NextResponse.json(
      { error: "BMC credentials not configured in .env" },
      { status: 503 },
    );
  }

  const equipmentList = await prisma.equipment.findMany({
    where: { id: { in: payload.equipmentIds } },
    select: {
      id: true,
      hostname: true,
      bmcIpAddress: true,
      rack: { select: { room: { select: { bmcProxyUrl: true } } } },
    },
  });

  const equipmentMap = new Map(equipmentList.map((e) => [e.id, e]));
  const results: ResultItem[] = [];

  for (const eqId of payload.equipmentIds) {
    const eq = equipmentMap.get(eqId);
    if (!eq) {
      results.push({ equipmentId: eqId, hostname: null, bmcIp: null, success: false, error: "Not found" });
      continue;
    }
    if (!eq.bmcIpAddress) {
      results.push({ equipmentId: eqId, hostname: eq.hostname, bmcIp: null, success: false, error: "No BMC IP" });
      continue;
    }

    let creds;
    try {
      creds = getBmcCredentials(eq as unknown as Parameters<typeof getBmcCredentials>[0]);
    } catch (err) {
      results.push({
        equipmentId: eqId,
        hostname: eq.hostname,
        bmcIp: eq.bmcIpAddress,
        success: false,
        error: err instanceof MissingBmcCredentialsError ? err.message : "Credential error",
      });
      continue;
    }

    const opts = {
      host: eq.bmcIpAddress,
      username: creds.username,
      password: creds.password,
      timeoutMs: 15_000,
      proxyUrl: eq.rack?.room?.bmcProxyUrl ?? undefined,
    };

    if (payload.action === "refresh-hw") {
      try {
        const hw = await getSystemHwInfo(opts);
        await saveHwInfo(eqId, hw);
        results.push({
          equipmentId: eqId,
          hostname: eq.hostname,
          bmcIp: eq.bmcIpAddress,
          success: true,
          data: {
            manufacturer: hw.manufacturer,
            model: hw.model,
            cpuCount: hw.cpus.length,
            totalMemoryGiB: hw.totalMemoryGiB,
            dimmSlots: hw.memories.length,
            dimmPopulated: hw.memories.filter((m) => m.populated).length,
            nicCount: hw.networkInterfaces.length,
          },
        });
      } catch (err) {
        results.push({
          equipmentId: eqId,
          hostname: eq.hostname,
          bmcIp: eq.bmcIpAddress,
          success: false,
          error: err instanceof RedfishError ? err.message : "Failed to fetch HW info",
        });
      }
    } else if (payload.action === "power") {
      try {
        await resetSystem(opts, payload.resetType as ResetType);
        results.push({
          equipmentId: eqId,
          hostname: eq.hostname,
          bmcIp: eq.bmcIpAddress,
          success: true,
          data: { resetType: payload.resetType },
        });
      } catch (err) {
        results.push({
          equipmentId: eqId,
          hostname: eq.hostname,
          bmcIp: eq.bmcIpAddress,
          success: false,
          error: err instanceof RedfishError ? err.message : "Power action failed",
        });
      }
    } else if (payload.action === "power-status") {
      try {
        const state = await getPowerState(opts);
        results.push({
          equipmentId: eqId,
          hostname: eq.hostname,
          bmcIp: eq.bmcIpAddress,
          success: true,
          data: { powerState: state },
        });
      } catch (err) {
        results.push({
          equipmentId: eqId,
          hostname: eq.hostname,
          bmcIp: eq.bmcIpAddress,
          success: false,
          error: err instanceof RedfishError ? err.message : "BMC unreachable",
        });
      }
    }
  }

  if (payload.action !== "power-status") {
    await logAudit({
      userId: user.id,
      action: payload.action === "power" ? "BULK_POWER" : "BULK_REFRESH_HW",
      entityType: "Equipment",
      entityId: "bulk",
      changes: {
        total: payload.equipmentIds.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        ...(payload.action === "power" ? { resetType: payload.resetType } : {}),
      },
      reason: payload.action === "power" ? payload.reason : "Bulk hardware refresh",
    });
  }

  return NextResponse.json({
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
