import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canAcknowledgeAlert } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const AckSchema = z.object({
  action: z.enum(["acknowledge", "resolve"]),
  note: z.string().trim().max(2000).nullable().optional(),
});

/**
 * POST /api/alerts/[id]/ack
 * Acknowledge or resolve an alert. ADMIN/OPERATOR only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAcknowledgeAlert(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, AckSchema);
  if (parsed.response) return parsed.response;
  const { action, note } = parsed.data;

  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "acknowledge") {
    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgement: {
          create: { userId: user.id, note: note ?? null },
        },
      },
      include: { acknowledgement: { include: { user: { select: { name: true, email: true } } } } },
    });

    await logAudit({
      userId: user.id,
      action: "STATUS_CHANGE",
      entityType: "Alert",
      entityId: id,
      changes: { status: { from: alert.status, to: "ACKNOWLEDGED" } },
      reason: note ?? null,
    });

    return NextResponse.json(updated);
  }

  // resolve
  const updated = await prisma.alert.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
    include: { acknowledgement: { include: { user: { select: { name: true, email: true } } } } },
  });

  await logAudit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entityType: "Alert",
    entityId: id,
    changes: { status: { from: alert.status, to: "RESOLVED" } },
    reason: note ?? null,
  });

  return NextResponse.json(updated);
}
