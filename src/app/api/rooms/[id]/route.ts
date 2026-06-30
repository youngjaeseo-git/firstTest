export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit, canDelete } from "@/lib/rbac";
import { logAudit, diffShallow } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { UpdateRoomSchema } from "@/lib/schemas/room";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      dataCenter: true,
      racks: {
        include: {
          equipment: {
            orderBy: { rackPosition: "asc" },
          },
          _count: { select: { equipment: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(room);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" },
      { status: 403 },
    );
  }

  const parsed = await parseBody(req, UpdateRoomSchema);
  if (parsed.response) return parsed.response;

  const before = await prisma.room.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const room = await prisma.room.update({
    where: { id },
    data: parsed.data,
    include: { dataCenter: true, racks: true },
  });

  const changes = diffShallow(
    before as unknown as Record<string, unknown>,
    room as unknown as Record<string, unknown>,
  );
  const changedKeys = Object.keys(changes).filter(
    (k) => !["updatedAt", "createdAt"].includes(k),
  );
  if (changedKeys.length > 0) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "Room",
      entityId: id,
      changes: Object.fromEntries(changedKeys.map((k) => [k, changes[k]])),
    });
  }

  return NextResponse.json(room);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canDelete(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 권한 필요" },
      { status: 403 },
    );
  }

  const room = await prisma.room.findUnique({
    where: { id },
    include: { _count: { select: { racks: true } } },
  });
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (room._count.racks > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete room "${room.name}" — it still contains ${room._count.racks} rack(s). Remove or move all racks first.`,
      },
      { status: 409 },
    );
  }

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body.reason;
  } catch {
    // no body is fine
  }

  await prisma.room.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "Room",
    entityId: id,
    changes: { name: room.name, dataCenterId: room.dataCenterId },
    reason,
  });

  return NextResponse.json({ success: true });
}
