import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { instantQuery } from "@/lib/prometheus";

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
    labels.hostname || labels.nodename || instanceHost || instance;

  let ipAddress = isIp ? instanceHost : (labels._ip || null);
  let osImage: string | null = null;
  let kernelVersion: string | null = null;
  let totalMemoryGB: number | null = null;
  let cpuCores: number | null = null;

  const matcher = `instance=~"${instanceHost}(:.*)?"`;

  // Query kube_node_info for OS metadata
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
    } catch (e) {
      console.error("[Register] kube_node_info query failed:", e);
    }
  }

  // Memory from cAdvisor
  try {
    const memResult = await instantQuery(
      `max(machine_memory_bytes{${matcher}})`
    );
    if (memResult.data?.result?.[0]?.value?.[1]) {
      const bytes = parseFloat(memResult.data.result[0].value[1]);
      totalMemoryGB = Math.round(bytes / (1024 * 1024 * 1024));
    }
  } catch (e) {
    console.error("[Register] memory query failed:", e);
  }

  // CPU cores from cAdvisor
  try {
    const cpuResult = await instantQuery(
      `max(machine_cpu_cores{${matcher}})`
    );
    if (cpuResult.data?.result?.[0]?.value?.[1]) {
      cpuCores = parseInt(cpuResult.data.result[0].value[1], 10);
    }
  } catch (e) {
    console.error("[Register] cpu query failed:", e);
  }

  // Determine health: check if ANY up metric exists
  let isUp = target.health === "up";
  if (!isUp) {
    try {
      const upResult = await instantQuery(
        `up{${matcher}}`
      );
      if (upResult.data?.result) {
        isUp = upResult.data.result.some(
          (r: { value?: [number, string] }) => r.value?.[1] === "1",
        );
      }
    } catch {}
  }

  const equipment = await prisma.equipment.create({
    data: {
      hostname,
      ipAddress,
      type: "SERVER",
      status: isUp ? "ACTIVE" : "INSTALLED",
      totalMemoryGB,
      osType: osImage ? "Linux" : null,
      osVersion: osImage || null,
      biosVersion: kernelVersion ? `kernel ${kernelVersion}` : null,
      prometheusInstance: instance,
      prometheusTarget: { connect: { id: target.id } },
      ...(cpuCores
        ? {
            cpus: {
              create: {
                socketIndex: 0,
                cores: cpuCores,
                threads: cpuCores,
                manufacturer: "Auto-detected",
                model: `${cpuCores} cores (total)`,
              },
            },
          }
        : {}),
    },
  });

  console.log("[Register] created:", {
    id: equipment.id,
    hostname: equipment.hostname,
    ipAddress: equipment.ipAddress,
    osVersion: equipment.osVersion,
    totalMemoryGB: equipment.totalMemoryGB,
    cpuCores,
  });

  return NextResponse.json({ equipment });
}
