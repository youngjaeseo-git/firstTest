import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

  return NextResponse.json({ success: true });
}
