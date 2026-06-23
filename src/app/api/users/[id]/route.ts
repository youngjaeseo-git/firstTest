import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { logAudit, diffShallow } from "@/lib/audit";
import { Role } from "@prisma/client";

const UpdateUserSchema = z.object({
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]).optional(),
  approved: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, UpdateUserSchema);
  if (parsed.response) return parsed.response;
  const { role, approved } = parsed.data;

  const before = await prisma.user.findUnique({
    where: { id },
    select: { role: true, approved: true },
  });

  const data: { role?: Role; approved?: boolean } = {};
  if (role !== undefined) data.role = role;
  if (approved !== undefined) data.approved = approved;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, approved: true },
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    changes: diffShallow(
      { role: before?.role, approved: before?.approved },
      { role: user.role, approved: user.approved },
    ),
  });

  return NextResponse.json(user);
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

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "DELETE",
    entityType: "User",
    entityId: id,
    changes: { email: user.email, role: user.role },
  });

  return NextResponse.json({ success: true });
}
