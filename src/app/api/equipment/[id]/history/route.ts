import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { logAudit, type AuditAction } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";

const MANUAL_ACTIONS = [
  "MAINTENANCE_START",
  "MAINTENANCE_END",
  "STATUS_CHANGE",
  "RACK_MOVE",
  "UPDATE",
] as const satisfies readonly AuditAction[];

const HistoryEntrySchema = z.object({
  action: z.enum(MANUAL_ACTIONS),
  reason: z.string().trim().min(3, "reason is required (min 3 chars)").max(1000),
  ticketRef: z.string().trim().max(50).optional().nullable(),
  changes: z.record(z.unknown()).optional(),
});

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

  const parsed = await parseBody(req, HistoryEntrySchema);
  if (parsed.response) return parsed.response;
  const { action, reason, changes = {} } = parsed.data;
  const ticketRef = parsed.data.ticketRef?.trim() || null;

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
