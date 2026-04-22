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
  const ipAddress = isIp ? instanceHost : null;
  const matcher = `instance=~"${instanceHost}(:.*)?"`;

  let totalMemoryGB: number | null = null;
  let cpuCores: number | null = null;

  const memQuery = `max(machine_memory_bytes{${matcher}})`;
  const cpuQuery = `max(machine_cpu_cores{${matcher}})`;

  console.log("[Register] target:", { instance, instanceHost, isIp, hostname });
  console.log("[Register] memQuery:", memQuery);
  console.log("[Register] cpuQuery:", cpuQuery);

  try {
    const memResult = await instantQuery(memQuery);
    console.log("[Register] memResult status:", memResult.status, "resultCount:", memResult.data?.result?.length ?? 0);
    if (memResult.data?.result?.[0]?.value?.[1]) {
      const bytes = parseFloat(memResult.data.result[0].value[1]);
      totalMemoryGB = Math.round(bytes / (1024 * 1024 * 1024));
    }
    console.log("[Register] memory:", totalMemoryGB, "GB");
  } catch (e) {
    console.error("[Register] memory query FAILED:", e);
  }

  try {
    const cpuResult = await instantQuery(cpuQuery);
    console.log("[Register] cpuResult status:", cpuResult.status, "resultCount:", cpuResult.data?.result?.length ?? 0);
    if (cpuResult.data?.result?.[0]?.value?.[1]) {
      cpuCores = parseInt(cpuResult.data.result[0].value[1], 10);
    }
    console.log("[Register] cpu:", cpuCores, "cores");
  } catch (e) {
    console.error("[Register] cpu query FAILED:", e);
  }

  const equipment = await prisma.equipment.create({
    data: {
      hostname,
      ipAddress,
      type: "SERVER",
      status: target.health === "up" ? "ACTIVE" : "INSTALLED",
      totalMemoryGB,
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
                model: `${cpuCores} cores`,
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
    totalMemoryGB: equipment.totalMemoryGB,
    prometheusInstance: equipment.prometheusInstance,
    cpuCores,
  });

  return NextResponse.json({ equipment });
}
