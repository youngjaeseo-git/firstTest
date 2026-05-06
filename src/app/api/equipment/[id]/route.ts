import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit, canDelete } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      rack: { include: { room: { include: { dataCenter: true } } } },
      cpus: { orderBy: { socketIndex: "asc" } },
      memories: { orderBy: { slotIndex: "asc" } },
      networkPorts: true,
      prometheusTarget: true,
    },
  });

  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(equipment);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { cpus, memories, ...equipmentData } = body;

  const equipment = await prisma.$transaction(async (tx) => {
    if (cpus) {
      await tx.equipmentCpu.deleteMany({ where: { equipmentId: id } });
      if (cpus.length > 0) {
        await tx.equipmentCpu.createMany({
          data: cpus.map((c: Record<string, unknown>) => ({
            ...c,
            equipmentId: id,
          })),
        });
      }
    }

    return tx.equipment.update({
      where: { id },
      data: equipmentData,
      include: { cpus: true, memories: true, rack: true },
    });
  });

  return NextResponse.json(equipment);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canDelete(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 권한 필요" },
      { status: 403 },
    );
  }

  await prisma.equipment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
