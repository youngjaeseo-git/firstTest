import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTargets, type DiscoveredPrometheusTarget } from "@/lib/prometheus";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const targets = await fetchTargets();
    let created = 0;
    let updated = 0;

    const instanceMap = new Map<string, DiscoveredPrometheusTarget[]>();
    for (const target of targets) {
      const arr = instanceMap.get(target.instance) || [];
      arr.push(target);
      instanceMap.set(target.instance, arr);
    }

    for (const [instance, instanceTargets] of Array.from(instanceMap)) {
      const upTargets = instanceTargets.filter(
        (t: DiscoveredPrometheusTarget) => t.health === "up"
      );
      const health = upTargets.length > 0 ? "up" : "down";
      const best =
        upTargets.find((t: DiscoveredPrometheusTarget) => t.job === "kubernetes-cadvisor") ||
        upTargets[0] ||
        instanceTargets.find((t: DiscoveredPrometheusTarget) => t.job === "kubernetes-cadvisor") ||
        instanceTargets[0];

      const jobs = instanceTargets.map((t: DiscoveredPrometheusTarget) => t.job);
      const uniqueJobs = Array.from(new Set(jobs)).sort();

      const existing = await prisma.prometheusTarget.findUnique({
        where: { instance },
      });

      const detectedIp = instanceTargets.find(
        (t: DiscoveredPrometheusTarget) => t.address && /^\d+\.\d+\.\d+\.\d+$/.test(t.address)
      )?.address || null;

      const data = {
        job: best.job,
        hostname:
          best.labels.hostname || best.labels.nodename || null,
        labels: { ...best.labels, _allJobs: uniqueJobs, ...(detectedIp ? { _ip: detectedIp } : {}) },
        health,
        lastSeen: new Date(),
      };

      if (existing) {
        await prisma.prometheusTarget.update({
          where: { instance },
          data,
        });
        updated++;
      } else {
        await prisma.prometheusTarget.create({
          data: { instance, ...data },
        });
        created++;
      }
    }

    const allTargets = await prisma.prometheusTarget.findMany({
      orderBy: [{ health: "asc" }, { instance: "asc" }],
      include: { equipment: { select: { id: true, hostname: true } } },
    });

    return NextResponse.json({
      synced: targets.length,
      created,
      updated,
      targets: allTargets.map((t) => ({
        id: t.id,
        instance: t.instance,
        job: t.job,
        hostname: t.hostname,
        health: t.health,
        lastSeen: t.lastSeen.toISOString(),
        equipmentId: t.equipmentId,
        equipmentHostname: t.equipment?.hostname || null,
        labels: t.labels,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Prometheus targets" },
      { status: 502 },
    );
  }
}
