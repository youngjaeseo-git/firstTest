export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit, canDelete } from "@/lib/rbac";
import { logAudit, diffShallow } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { UpdateRoomElementSchema } from "@/lib/schemas/room-element";

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

  const parsed = await parseBody(req, UpdateRoomElementSchema);
  if (parsed.response) return parsed.response;

  const before = await prisma.roomElement.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { metadata, ...rest } = parsed.data;
  const element = await prisma.roomElement.update({
    where: { id },
    data: {
      ...rest,
      ...(metadata !== undefined && {
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      }),
    },
  });

  const changes = diffShallow(
    before as unknown as Record<string, unknown>,
    element as unknown as Record<string, unknown>,
  );
  const changedKeys = Object.keys(changes).filter(
    (k) => !["updatedAt", "createdAt"].includes(k),
  );
  if (changedKeys.length > 0) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "RoomElement",
      entityId: id,
      changes: Object.fromEntries(changedKeys.map((k) => [k, changes[k]])),
    });
  }

  return NextResponse.json(element);
}

export async function DELETE(
  _req: NextRequest,
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

  const element = await prisma.roomElement.findUnique({ where: { id } });
  if (!element) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.roomElement.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "RoomElement",
    entityId: id,
    changes: { type: element.type, name: element.name },
  });

  return NextResponse.json({ success: true });
}
