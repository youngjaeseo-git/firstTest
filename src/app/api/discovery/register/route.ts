import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { instantQuery } from "@/lib/prometheus";

async function resolveIpFromTargets(hostname: string): Promise<string | null> {
  const allTargets = await prisma.prometheusTarget.findMany({
    where: {
      job: { in: ["kubernetes-nodes", "AE-SMC-SRF-PCM", "temperature"] },
    },
    select: { instance: true, labels: true, hostname: true },
  });

  for (const t of allTargets) {
    const tLabels = (t.labels ?? {}) as Record<string, string>;
    const tHostname =
      t.hostname || tLabels.hostname || tLabels.nodename || tLabels.node;
    if (tHostname === hostname) {
      const tIp = t.instance.split(":")[0];
      if (/^\d+\.\d+\.\d+\.\d+$/.test(tIp)) {
        return tIp;
      }
    }
  }
  return null;
}

async function resolveIpFromPrometheus(
  hostname: string,
): Promise<string | null> {
  try {
    const result = await instantQuery(
      `machine_memory_bytes{node="${hostname}"}`,
    );
    const instance = result.data?.result?.[0]?.metric?.instance;
    if (instance) {
      const foundIp = instance.split(":")[0];
      if (/^\d+\.\d+\.\d+\.\d+$/.test(foundIp)) return foundIp;
    }
  } catch {}

  try {
    const result = await instantQuery(
      `up{job="kubernetes-nodes",node="${hostname}"}`,
    );
    const instance = result.data?.result?.[0]?.metric?.instance;
    if (instance) {
      const foundIp = instance.split(":")[0];
      if (/^\d+\.\d+\.\d+\.\d+$/.test(foundIp)) return foundIp;
    }
  } catch {}

  try {
    const result = await instantQuery(`up{job="kubernetes-nodes"}`);
    if (result.data?.result) {
      for (const r of result.data.result) {
        const m = r.metric || {};
        if (
          m.node === hostname ||
          m.nodename === hostname ||
          m.hostname === hostname
        ) {
          const foundIp = (m.instance || "").split(":")[0];
          if (/^\d+\.\d+\.\d+\.\d+$/.test(foundIp)) return foundIp;
        }
      }
    }
  } catch {}

  return null;
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
    labels.hostname || labels.nodename || instanceHost || instance;

  let resolvedIp: string | null = isIp ? instanceHost : null;

  if (!isIp) {
    console.log("[Register] Instance is hostname, resolving IP for:", instanceHost);

    resolvedIp = await resolveIpFromTargets(instanceHost);
    if (resolvedIp) {
      console.log("[Register] IP resolved from DB targets:", resolvedIp);
    } else {
      resolvedIp = await resolveIpFromPrometheus(instanceHost);
      if (resolvedIp) {
        console.log("[Register] IP resolved from Prometheus:", resolvedIp);
      } else {
        console.log("[Register] Could not resolve IP for hostname:", instanceHost);
      }
    }
  }

  const ipAddress = resolvedIp;
  const queryHost = resolvedIp || instanceHost;
  const ipPattern = `instance=~"${queryHost}(:.*)?"`;

  console.log("[Register]", {
    targetId,
    instance,
    instanceHost,
    isIp,
    hostname,
    ipAddress,
    resolvedIp,
    queryHost,
    ipPattern,
    labelsKeys: Object.keys(labels),
  });

  let totalMemoryGB: number | null = null;
  let cpuCores: number | null = null;

  try {
    const memResult = await instantQuery(
      `max(machine_memory_bytes{${ipPattern}})`,
    );
    if (memResult.data?.result?.[0]?.value?.[1]) {
      const bytes = parseFloat(memResult.data.result[0].value[1]);
      totalMemoryGB = Math.round(bytes / (1024 * 1024 * 1024));
    }
    console.log("[Register] memory query result:", totalMemoryGB, "GB");
  } catch (e) {
    console.error("[Register] memory query failed:", e);
  }

  try {
    const cpuResult = await instantQuery(
      `max(machine_cpu_cores{${ipPattern}})`,
    );
    if (cpuResult.data?.result?.[0]?.value?.[1]) {
      cpuCores = parseInt(cpuResult.data.result[0].value[1], 10);
    }
    console.log("[Register] cpu query result:", cpuCores, "cores");
  } catch (e) {
    console.error("[Register] cpu query failed:", e);
  }

  const prometheusInstance = resolvedIp
    ? `${resolvedIp}:10250`
    : instance;

  const equipment = await prisma.equipment.create({
    data: {
      hostname,
      ipAddress,
      type: "SERVER",
      status: target.health === "up" ? "ACTIVE" : "INSTALLED",
      totalMemoryGB,
      prometheusInstance,
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

  console.log("[Register] created equipment:", {
    id: equipment.id,
    hostname: equipment.hostname,
    ipAddress: equipment.ipAddress,
    totalMemoryGB: equipment.totalMemoryGB,
    prometheusInstance: equipment.prometheusInstance,
    cpuCores,
  });

  return NextResponse.json({ equipment });
}
