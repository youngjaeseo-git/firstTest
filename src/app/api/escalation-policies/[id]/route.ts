import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { logAudit, diffShallow } from "@/lib/audit";

const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).nullable(),
    severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
    afterMinutes: z.number().int().min(1).max(10080),
    channelId: z.string().trim().min(1).nullable(),
    enabled: z.boolean(),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, UpdateSchema);
  if (parsed.response) return parsed.response;

  const before = await prisma.escalationPolicy.findUnique({ where: { id } });
  const policy = await prisma.escalationPolicy.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "UPDATE",
    entityType: "EscalationPolicy",
    entityId: id,
    changes: before
      ? diffShallow(
          before as unknown as Record<string, unknown>,
          policy as unknown as Record<string, unknown>,
        )
      : (parsed.data as Record<string, unknown>),
  });

  return NextResponse.json(policy);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await prisma.escalationPolicy.findUnique({
    where: { id },
    select: { name: true },
  });

  await prisma.escalationPolicy.delete({ where: { id } });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "DELETE",
    entityType: "EscalationPolicy",
    entityId: id,
    changes: before ? { name: before.name } : undefined,
  });

  return NextResponse.json({ success: true });
}
