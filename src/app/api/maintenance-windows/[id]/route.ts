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
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    targetType: z.enum(["all", "source", "category"]),
    targetValue: z.string().trim().max(200).nullable(),
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
  if (!session || !["ADMIN", "OPERATOR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, UpdateSchema);
  if (parsed.response) return parsed.response;

  const before = await prisma.maintenanceWindow.findUnique({ where: { id } });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startTime) data.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime) data.endTime = new Date(parsed.data.endTime);

  const win = await prisma.maintenanceWindow.update({ where: { id }, data });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "UPDATE",
    entityType: "MaintenanceWindow",
    entityId: id,
    changes: before
      ? diffShallow(
          before as unknown as Record<string, unknown>,
          win as unknown as Record<string, unknown>,
        )
      : (parsed.data as Record<string, unknown>),
  });

  return NextResponse.json(win);
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

  const before = await prisma.maintenanceWindow.findUnique({
    where: { id },
    select: { name: true },
  });

  await prisma.maintenanceWindow.delete({ where: { id } });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "DELETE",
    entityType: "MaintenanceWindow",
    entityId: id,
    changes: before ? { name: before.name } : undefined,
  });

  return NextResponse.json({ success: true });
}
