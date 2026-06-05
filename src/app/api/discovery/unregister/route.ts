import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, z.object({ targetId: z.string().min(1) }));
  if (parsed.response) return parsed.response;
  const { targetId } = parsed.data;

  const target = await prisma.prometheusTarget.findUnique({
    where: { id: targetId },
    include: { equipment: true },
  });

  if (!target || !target.equipmentId) {
    return NextResponse.json({ error: "Target not linked to equipment" }, { status: 404 });
  }

  const equipmentId = target.equipmentId;

  await prisma.equipmentCpu.deleteMany({ where: { equipmentId } });
  await prisma.equipmentMemory.deleteMany({ where: { equipmentId } });
  await prisma.prometheusTarget.update({
    where: { id: targetId },
    data: { equipmentId: null },
  });
  await prisma.equipment.delete({ where: { id: equipmentId } });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "DELETE",
    entityType: "Equipment",
    entityId: equipmentId,
    changes: {
      hostname: target.equipment?.hostname ?? null,
      ipAddress: target.equipment?.ipAddress ?? null,
      source: "discovery-unregister",
      instance: target.instance,
    },
  });

  return NextResponse.json({ success: true });
}
