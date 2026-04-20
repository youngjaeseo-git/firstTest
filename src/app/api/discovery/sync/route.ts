import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTargets } from "@/lib/prometheus";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const targets = await fetchTargets();
    let created = 0;
    let updated = 0;

    for (const target of targets) {
      const existing = await prisma.prometheusTarget.findUnique({
        where: { instance: target.instance },
      });

      if (existing) {
        await prisma.prometheusTarget.update({
          where: { instance: target.instance },
          data: {
            job: target.job,
            labels: target.labels,
            health: target.health,
            lastSeen: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.prometheusTarget.create({
          data: {
            instance: target.instance,
            job: target.job,
            hostname: target.labels.hostname || target.labels.instance || target.instance,
            labels: target.labels,
            health: target.health,
            lastSeen: new Date(),
          },
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
  } catch (error) {
    console.error("Discovery sync error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Prometheus targets" },
      { status: 502 },
    );
  }
}
