import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canChangeStatus } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";

const StatusSchema = z.object({
  status: z.enum([
    "PLANNED",
    "RECEIVING",
    "INSTALLED",
    "ACTIVE",
    "MAINTENANCE",
    "REPAIR",
    "FAILED",
    "DECOMMISSIONED",
    "DISPOSED",
  ]),
  note: z.string().trim().max(1000).optional(),
});

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

  const parsed = await parseBody(req, StatusSchema);
  if (parsed.response) return parsed.response;
  const { status, note } = parsed.data;

  const equipment = await prisma.equipment.findUnique({
    where: { id },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Org-based access check
  if (user.role !== "ADMIN" && equipment.organizationId && !user.orgIds?.includes(equipment.organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const oldStatus = equipment.status;

  const updated = await prisma.equipment.update({
    where: { id },
    data: { status },
  });

  await logAudit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entityType: "Equipment",
    entityId: id,
    changes: { status: { from: oldStatus, to: status }, note },
  });

  return NextResponse.json(updated);
}
