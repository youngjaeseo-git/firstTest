import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { logAudit, diffShallow } from "@/lib/audit";

// Whitelist of mutable fields — prevents arbitrary column injection via PATCH body.
const UpdateRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).nullable(),
    metric: z.string().trim().min(1).max(2000),
    condition: z.string().trim().min(1).max(200),
    duration: z.number().int().min(0).max(86400),
    severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
    category: z.string().trim().max(100).nullable(),
    enabled: z.boolean(),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !["ADMIN", "OPERATOR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, UpdateRuleSchema);
  if (parsed.response) return parsed.response;

  const before = await prisma.alertRule.findUnique({ where: { id } });

  const rule = await prisma.alertRule.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "UPDATE",
    entityType: "AlertRule",
    entityId: id,
    changes: before
      ? diffShallow(
          before as unknown as Record<string, unknown>,
          rule as unknown as Record<string, unknown>,
        )
      : (parsed.data as Record<string, unknown>),
  });

  return NextResponse.json(rule);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await prisma.alertRule.findUnique({
    where: { id },
    select: { name: true, severity: true },
  });

  await prisma.alertRule.delete({ where: { id } });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "DELETE",
    entityType: "AlertRule",
    entityId: id,
    changes: before ? { name: before.name, severity: before.severity } : undefined,
  });

  return NextResponse.json({ success: true });
}
