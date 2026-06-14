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
    type: z.enum(["EMAIL", "SLACK", "TEAMS", "WEBHOOK"]),
    target: z.string().trim().min(1).max(500),
    minSeverity: z.enum(["CRITICAL", "WARNING", "INFO"]),
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

  const before = await prisma.notificationChannel.findUnique({ where: { id } });
  const channel = await prisma.notificationChannel.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "UPDATE",
    entityType: "NotificationChannel",
    entityId: id,
    changes: before
      ? diffShallow(
          before as unknown as Record<string, unknown>,
          channel as unknown as Record<string, unknown>,
        )
      : (parsed.data as Record<string, unknown>),
  });

  return NextResponse.json(channel);
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

  const before = await prisma.notificationChannel.findUnique({
    where: { id },
    select: { name: true, type: true },
  });

  await prisma.notificationChannel.delete({ where: { id } });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "DELETE",
    entityType: "NotificationChannel",
    entityId: id,
    changes: before ? { name: before.name, type: before.type } : undefined,
  });

  return NextResponse.json({ success: true });
}
