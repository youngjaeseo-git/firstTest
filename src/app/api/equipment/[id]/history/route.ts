import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { logAudit, type AuditAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANUAL_ACTIONS: AuditAction[] = [
  "MAINTENANCE_START",
  "MAINTENANCE_END",
  "STATUS_CHANGE",
  "RACK_MOVE",
  "UPDATE",
];

/**
 * GET /api/equipment/[id]/history
 * Returns audit log entries for this equipment, newest first.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = parseInt(
    req.nextUrl.searchParams.get("limit") || "50",
    10,
  );
  const limit = Math.min(Math.max(limitParam || 50, 1), 200);

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "Equipment", entityId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items: entries });
}

/**
 * POST /api/equipment/[id]/history
 * Add a manual history entry (maintenance, repair, note, etc.)
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

  const body = await req.json();
  const action = body.action as AuditAction;
  const reason = (body.reason || "").trim();
  const ticketRef = (body.ticketRef || "").trim() || null;
  const changes = body.changes || {};

  if (!action || !MANUAL_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${MANUAL_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (reason.length < 3) {
    return NextResponse.json(
      { error: "reason is required (min 3 chars)" },
      { status: 400 },
    );
  }

  const equipment = await prisma.equipment.findUnique({ where: { id } });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAudit({
    userId: user.id,
    action,
    entityType: "Equipment",
    entityId: id,
    changes,
    reason,
    ticketRef,
  });

  return NextResponse.json({ success: true });
}
