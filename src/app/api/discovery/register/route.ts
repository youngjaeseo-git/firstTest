import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { instantQuery } from "@/lib/prometheus";
import {
  getSystemHwInfo,
  type RedfishOptions,
  type SystemHwInfo,
} from "@/lib/redfish";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
} from "@/lib/bmc-credentials";

const BMC_SUBNET = "192.168.10";

function deriveBmcIp(serverIp: string | null): string | null {
  if (!serverIp) return null;
  const parts = serverIp.split(".");
  if (parts.length !== 4) return null;
  return `${BMC_SUBNET}.${parts[3]}`;
}

function extractIpFromAddress(address: string | null): string | null {
  if (!address) return null;
  const host = address.split(":")[0];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  return null;
}

async function fetchRedfishInfo(
  bmcIp: string,
): Promise<SystemHwInfo | null> {
  if (!bmcCredentialsConfigured()) return null;
  try {
    const dummyEquipment = { id: "" } as Parameters<typeof getBmcCredentials>[0];
    const creds = getBmcCredentials(dummyEquipment);
    const opts: RedfishOptions = {
      host: bmcIp,
      username: creds.username,
      password: creds.password,
      timeoutMs: 10_000,
    };
    return await getSystemHwInfo(opts);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetId } = await req.json();
  if (!targetId) {
    return NextResponse.json({ error: "targetId required" }, { status: 400 });
  }

  const target = await prisma.prometheusTarget.findUnique({
    where: { id: targetId },
  });

  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  if (target.equipmentId) {
    return NextResponse.json(
      { error: "Target already linked to equipment" },
      { status: 409 },
    );
  }

  const instance = target.instance;
  const instanceHost = instance.split(":")[0];
  const labels = (target.labels ?? {}) as Record<string, string>;
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(instanceHost);

  const hostname =
    labels.kubernetes_io_hostname || labels.hostname || labels.nodename || instanceHost || instance;

  const ipAddress = isIp
    ? instanceHost
    : (labels._ip || extractIpFromAddress(labels.__address__) || null);

  const bmcIpAddress = deriveBmcIp(ipAddress);

  const memoryType = labels.memorytype || null;
  const owner = labels.owner || null;
  const group = labels.group || null;
  const allJobs = labels._allJobs as unknown;

  // --- Prometheus metrics ---
  let osImage: string | null = null;
  let kernelVersion: string | null = null;
  let totalMemoryGB: number | null = null;
  let cpuCores: number | null = null;

  const matcher = `instance=~"${instanceHost}(:.*)?"`;

  if (!isIp) {
    try {
      const nodeInfoResult = await instantQuery(
        `kube_node_info{node=~"${instanceHost}.*"}`
      );
      const metric = nodeInfoResult.data?.result?.[0]?.metric as
        | Record<string, string>
        | undefined;
      if (metric) {
        osImage = metric.os_image || null;
        kernelVersion = metric.kernel_version || null;
      }
    } catch {}
  }

  try {
    const memResult = await instantQuery(`max(machine_memory_bytes{${matcher}})`);
    if (memResult.data?.result?.[0]?.value?.[1]) {
      totalMemoryGB = Math.round(
        parseFloat(memResult.data.result[0].value[1]) / (1024 * 1024 * 1024)
      );
    }
  } catch {}

  try {
    const cpuResult = await instantQuery(`max(machine_cpu_cores{${matcher}})`);
    if (cpuResult.data?.result?.[0]?.value?.[1]) {
      cpuCores = parseInt(cpuResult.data.result[0].value[1], 10);
    }
  } catch {}

  let isUp = target.health === "up";
  if (!isUp) {
    try {
      const upResult = await instantQuery(`up{${matcher}}`);
      if (upResult.data?.result) {
        isUp = upResult.data.result.some(
          (r: { value?: [number, string] }) => r.value?.[1] === "1",
        );
      }
    } catch {}
  }

  // --- Redfish HW info (if BMC reachable) ---
  let hw: SystemHwInfo | null = null;
  if (bmcIpAddress) {
    hw = await fetchRedfishInfo(bmcIpAddress);
  }

  const manufacturer = hw?.manufacturer || null;
  const model = hw?.model || null;
  const serialNumber = hw?.serialNumber || null;
  const biosVersion = hw?.biosVersion || (kernelVersion ? `kernel ${kernelVersion}` : null);

  if (hw?.totalMemoryGiB && !totalMemoryGB) {
    totalMemoryGB = hw.totalMemoryGiB;
  }

  const jobList = Array.isArray(allJobs)
    ? (allJobs as string[]).join(", ")
    : null;

  const notes = [
    owner ? `owner: ${owner}` : null,
    group ? `group: ${group}` : null,
    memoryType ? `memory: ${memoryType}` : null,
    jobList ? `jobs: ${jobList}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Build CPU create data: prefer Redfish detailed info, fallback to Prometheus
  const cpuCreateData =
    hw && hw.cpus.length > 0
      ? hw.cpus.map((cpu, i) => ({
          socketIndex: i,
          manufacturer: cpu.manufacturer || null,
          model: cpu.model || null,
          cores: cpu.cores || null,
          threads: cpu.threads || null,
          baseFreqMhz: null as number | null,
          maxFreqMhz: cpu.maxSpeedMhz || null,
          architecture: cpu.architecture || null,
          tdpWatts: cpu.tdpWatts || null,
        }))
      : cpuCores
        ? [
            {
              socketIndex: 0,
              cores: cpuCores,
              threads: cpuCores,
              manufacturer: "Auto-detected" as string | null,
              model: `${cpuCores} cores (total)` as string | null,
              baseFreqMhz: null as number | null,
              maxFreqMhz: null as number | null,
              architecture: null as string | null,
              tdpWatts: null as number | null,
            },
          ]
        : [];

  const equipment = await prisma.equipment.create({
    data: {
      hostname,
      ipAddress,
      bmcIpAddress,
      manufacturer,
      model,
      serialNumber,
      type: "SERVER",
      status: isUp ? "ACTIVE" : "INSTALLED",
      totalMemoryGB: totalMemoryGB,
      osType: osImage ? "Linux" : null,
      osVersion: osImage || null,
      biosVersion,
      notes: notes || null,
      prometheusInstance: instance,
      prometheusTarget: { connect: { id: target.id } },
      ...(cpuCreateData.length > 0
        ? { cpus: { create: cpuCreateData } }
        : {}),
    },
  });

  return NextResponse.json({
    equipment,
    redfishAvailable: hw !== null,
  });
}
