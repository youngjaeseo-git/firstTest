export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { logAudit, AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * POST /api/audit
 *
 * Lightweight endpoint for client-side audit logging (e.g. report exports).
 * The caller supplies action, entityType, entityId and optional metadata;
 * userId is derived from the session so clients cannot spoof identity.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, entityType, entityId, changes, reason } = body as {
      action: AuditAction;
      entityType: AuditEntityType;
      entityId: string;
      changes?: Record<string, unknown>;
      reason?: string;
    };

    if (!action || !entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields: action, entityType, entityId" },
        { status: 400 },
      );
    }

    await logAudit({
      userId: user.id,
      action,
      entityType,
      entityId,
      changes,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
