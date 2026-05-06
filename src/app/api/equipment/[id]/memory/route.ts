import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const memories = await prisma.equipmentMemory.findMany({
    where: { equipmentId: id },
    orderBy: { slotIndex: "asc" },
  });

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: { cpus: { orderBy: { socketIndex: "asc" } } },
  });

  const populated = memories.filter((m) => m.populated);
  const summary = {
    totalSlots: memories.length,
    populatedSlots: populated.length,
    emptySlots: memories.length - populated.length,
    totalCapacityGb: populated.reduce((sum, m) => sum + (m.capacityGb || 0), 0),
    memoryTypes: Array.from(new Set(populated.map((m) => m.memoryType).filter(Boolean))),
    manufacturers: Array.from(new Set(populated.map((m) => m.manufacturer).filter(Boolean))),
    maxSpeedMhz: Math.max(...populated.map((m) => m.speedMhz || 0), 0) || null,
    eccEnabled: populated.some((m) => m.eccEnabled),
  };

  return NextResponse.json({ memories, cpus: equipment?.cpus || [], summary });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memories } = await req.json();

  await prisma.equipmentMemory.deleteMany({
    where: { equipmentId: id },
  });

  if (memories && memories.length > 0) {
    await prisma.equipmentMemory.createMany({
      data: memories.map((m: Record<string, unknown>, i: number) => ({
        ...m,
        equipmentId: id,
        slotIndex: i,
      })),
    });
  }

  const totalGb = (memories || [])
    .filter((m: { populated: boolean }) => m.populated)
    .reduce((sum: number, m: { capacityGb?: number }) => sum + (m.capacityGb || 0), 0);
  await prisma.equipment.update({
    where: { id },
    data: { totalMemoryGB: Math.round(totalGb) },
  });

  return NextResponse.json({ success: true });
}
