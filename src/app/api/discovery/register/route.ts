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
    labels.kubernetes_io_hostname || labels.hostname || labels.nodename || instanceHost || instance;
  const ipAddress = isIp ? instanceHost : (labels._ip || null);
  const memoryType = labels.memorytype || null;
  const owner = labels.owner || null;
  const group = labels.group || null;

  let osImage: string | null = null;
  let kernelVersion: string | null = null;
  let totalMemoryGB: number | null = null;
  let cpuCores: number | null = null;

  const matcher = `instance=~"${instanceHost}(:.*)?"`;

  // kube_node_info: OS, kernel
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

  // machine_memory_bytes
  try {
    const memResult = await instantQuery(`max(machine_memory_bytes{${matcher}})`);
    if (memResult.data?.result?.[0]?.value?.[1]) {
      totalMemoryGB = Math.round(
        parseFloat(memResult.data.result[0].value[1]) / (1024 * 1024 * 1024)
      );
    }
  } catch {}

  // machine_cpu_cores
  try {
    const cpuResult = await instantQuery(`max(machine_cpu_cores{${matcher}})`);
    if (cpuResult.data?.result?.[0]?.value?.[1]) {
      cpuCores = parseInt(cpuResult.data.result[0].value[1], 10);
    }
  } catch {}

  // health
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

  const notes = [
    owner ? `owner: ${owner}` : null,
    group ? `group: ${group}` : null,
    memoryType ? `memory: ${memoryType}` : null,
  ]
    .filter(Boolean)
    .join(", ");

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
      notes: notes || null,
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

  return NextResponse.json({ equipment });
}
