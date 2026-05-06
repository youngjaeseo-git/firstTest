import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canControlPower } from "@/lib/rbac";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
  MissingBmcCredentialsError,
} from "@/lib/bmc-credentials";
import {
  getPowerState,
  resetSystem,
  RedfishError,
  type ResetType,
} from "@/lib/redfish";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const RESET_TYPES = [
  "On",
  "ForceOff",
  "GracefulShutdown",
  "GracefulRestart",
  "ForceRestart",
] as const satisfies readonly ResetType[];

const PowerActionSchema = z.object({
  action: z.enum(RESET_TYPES),
  reason: z.string().trim().min(3, "Reason is required (min 3 chars)").max(500),
  ticketRef: z.string().trim().max(50).optional().nullable(),
});

/**
 * GET /api/equipment/[id]/power
 * Returns the current power state from the BMC. Available to any authenticated
 * user since reading is non-destructive.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!equipment.bmcIpAddress) {
    return NextResponse.json(
      { state: "Unknown", error: "No BMC IP configured for this equipment" },
      { status: 200 },
    );
  }
  if (!bmcCredentialsConfigured()) {
    return NextResponse.json(
      { state: "Unknown", error: "BMC credentials not configured" },
      { status: 200 },
    );
  }

  try {
    const creds = getBmcCredentials(equipment);
    const state = await getPowerState({
      host: equipment.bmcIpAddress,
      username: creds.username,
      password: creds.password,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message =
      err instanceof RedfishError || err instanceof MissingBmcCredentialsError
        ? err.message
        : "BMC unreachable";
    return NextResponse.json({ state: "Unknown", error: message }, { status: 200 });
  }
}

/**
 * POST /api/equipment/[id]/power
 * Issues a Redfish reset action. Requires ADMIN/OPERATOR + a reason.
 * Always recorded in AuditLog (success or failure).
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
  if (!canControlPower(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN or OPERATOR required" },
      { status: 403 },
    );
  }

  let payload: z.infer<typeof PowerActionSchema>;
  try {
    payload = PowerActionSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: err instanceof z.ZodError ? err.errors : undefined,
      },
      { status: 400 },
    );
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!equipment.bmcIpAddress) {
    return NextResponse.json(
      { error: "No BMC IP configured for this equipment" },
      { status: 400 },
    );
  }

  let creds;
  try {
    creds = getBmcCredentials(equipment);
  } catch (err) {
    if (err instanceof MissingBmcCredentialsError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  let success = false;
  let errorMessage: string | null = null;
  try {
    await resetSystem(
      {
        host: equipment.bmcIpAddress,
        username: creds.username,
        password: creds.password,
      },
      payload.action,
    );
    success = true;
  } catch (err) {
    errorMessage =
      err instanceof RedfishError ? err.message : "BMC reset failed";
  }

  // Always audit, regardless of outcome
  await logAudit({
    userId: user.id,
    action: "POWER_ACTION",
    entityType: "Equipment",
    entityId: equipment.id,
    changes: {
      resetType: payload.action,
      bmcHost: equipment.bmcIpAddress,
      success,
      ...(errorMessage ? { error: errorMessage } : {}),
    },
    reason: payload.reason,
    ticketRef: payload.ticketRef ?? null,
  });

  if (!success) {
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  return NextResponse.json({ success: true, action: payload.action });
}
