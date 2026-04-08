import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !role || !["ADMIN", "OPERATOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, note } = await req.json();

  const equipment = await prisma.equipment.findUnique({
    where: { id: params.id },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const oldStatus = equipment.status;

  const updated = await prisma.equipment.update({
    where: { id: params.id },
    data: { status },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: (session.user as { id: string }).id,
      action: "STATUS_CHANGE",
      entityType: "Equipment",
      entityId: params.id,
      changes: { status: { old: oldStatus, new: status }, note },
    },
  });

  return NextResponse.json(updated);
}
