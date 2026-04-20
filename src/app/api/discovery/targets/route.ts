import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targets = await prisma.prometheusTarget.findMany({
    orderBy: [{ health: "asc" }, { instance: "asc" }],
    include: { equipment: { select: { id: true, hostname: true } } },
  });

  return NextResponse.json({
    targets: targets.map((t) => ({
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
}
