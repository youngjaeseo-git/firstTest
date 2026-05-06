import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canChangeStatus } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canChangeStatus(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" },
      { status: 403 },
    );
  }

  const { status, note } = await req.json();

  const equipment = await prisma.equipment.findUnique({
    where: { id },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const oldStatus = equipment.status;

  const updated = await prisma.equipment.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "STATUS_CHANGE",
      entityType: "Equipment",
      entityId: id,
      changes: { status: { old: oldStatus, new: status }, note },
    },
  });

  return NextResponse.json(updated);
}
