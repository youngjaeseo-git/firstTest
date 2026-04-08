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
    let newCount = 0;
    let updatedCount = 0;

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
        updatedCount++;
      } else {
        await prisma.prometheusTarget.create({
          data: {
            instance: target.instance,
            job: target.job,
            hostname: target.labels.__name__ || target.labels.instance,
            labels: target.labels,
            health: target.health,
            lastSeen: new Date(),
          },
        });
        newCount++;
      }
    }

    return NextResponse.json({
      discovered: targets.length,
      newTargets: newCount,
      updated: updatedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch Prometheus targets" },
      { status: 502 },
    );
  }
}
