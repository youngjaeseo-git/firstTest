export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit, canDelete } from "@/lib/rbac";
import { logAudit, diffShallow } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { UpdateRackSchema } from "@/lib/schemas/rack";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rack = await prisma.rack.findUnique({
    where: { id },
    include: {
      room: { include: { dataCenter: true } },
      equipment: {
        include: { cpus: true, _count: { select: { memories: true } } },
        orderBy: { rackPosition: "asc" },
      },
      pdus: true,
    },
  });

  if (!rack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build elevation data
  const units = Array.from({ length: rack.totalUnits }, (_, i) => {
    const position = i + 1;
    const eq = rack.equipment.find(
      (e) =>
        e.rackPosition !== null &&
        position >= e.rackPosition &&
        position < e.rackPosition + e.rackHeight,
    );
    return {
      position,
      occupied: !!eq,
      equipmentId: eq?.id || null,
      equipmentName: eq?.hostname || eq?.model || null,
      equipmentType: eq?.type || null,
      equipmentStatus: eq?.status || null,
      rackHeight: eq?.rackHeight || 1,
      isStartPosition: eq?.rackPosition === position,
    };
  });

  return NextResponse.json({ ...rack, units });
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

  const parsed = await parseBody(req, UpdateRackSchema);
  if (parsed.response) return parsed.response;

  const before = await prisma.rack.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If roomId is being changed, verify the new room exists
  if (parsed.data.roomId && parsed.data.roomId !== before.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: parsed.data.roomId },
    });
    if (!room) {
      return NextResponse.json(
        { error: "Room not found with the given roomId" },
        { status: 400 },
      );
    }
  }

  const rack = await prisma.rack.update({
    where: { id },
    data: parsed.data,
    include: { room: true },
  });

  const changes = diffShallow(
    before as unknown as Record<string, unknown>,
    rack as unknown as Record<string, unknown>,
  );
  const changedKeys = Object.keys(changes).filter(
    (k) => !["updatedAt", "createdAt"].includes(k),
  );
  if (changedKeys.length > 0) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "Rack",
      entityId: id,
      changes: Object.fromEntries(changedKeys.map((k) => [k, changes[k]])),
    });
  }

  return NextResponse.json(rack);
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

  const rack = await prisma.rack.findUnique({
    where: { id },
    include: { _count: { select: { equipment: true } } },
  });
  if (!rack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (rack._count.equipment > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete rack "${rack.name}" — it still contains ${rack._count.equipment} equipment item(s). Remove or move all equipment first.`,
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

  await prisma.rack.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "Rack",
    entityId: id,
    changes: { name: rack.name, roomId: rack.roomId },
    reason,
  });

  return NextResponse.json({ success: true });
}
