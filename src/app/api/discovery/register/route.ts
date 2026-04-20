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

  const instanceHost = target.instance.split(":")[0];
  const labels = (target.labels || {}) as Record<string, string>;

  const hostname = labels.hostname || labels.nodename || instanceHost;
  const ipAddress = /^\d+\.\d+\.\d+\.\d+$/.test(instanceHost) ? instanceHost : null;

  let totalMemoryGB: number | null = null;
  let cpuCores: number | null = null;
  try {
    const ipPattern = `instance=~"${instanceHost}:.*"`;
    const [memResult, cpuResult] = await Promise.allSettled([
      instantQuery(`max(machine_memory_bytes{${ipPattern}})`),
      instantQuery(`max(machine_cpu_cores{${ipPattern}})`),
    ]);
    if (memResult.status === "fulfilled" && memResult.value.data.result.length > 0) {
      const bytes = parseFloat(memResult.value.data.result[0].value[1]);
      totalMemoryGB = Math.round(bytes / (1024 * 1024 * 1024));
    }
    if (cpuResult.status === "fulfilled" && cpuResult.value.data.result.length > 0) {
      cpuCores = parseInt(cpuResult.value.data.result[0].value[1], 10);
    }
  } catch {}

  const equipment = await prisma.equipment.create({
    data: {
      hostname,
      ipAddress: ipAddress || instanceHost,
      type: "SERVER",
      status: target.health === "up" ? "ACTIVE" : "INSTALLED",
      totalMemoryGB,
      prometheusInstance: target.instance,
      prometheusTarget: { connect: { id: target.id } },
      ...(cpuCores ? {
        cpus: {
          create: {
            socketIndex: 0,
            cores: cpuCores,
            threads: cpuCores,
            manufacturer: "Auto-detected",
            model: `${cpuCores} cores`,
          },
        },
      } : {}),
    },
  });

  return NextResponse.json({ equipment });
}
