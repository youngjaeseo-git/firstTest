export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { CreateRackSchema } from "@/lib/schemas/rack";

export async function POST(req: NextRequest) {
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

  const parsed = await parseBody(req, CreateRackSchema);
  if (parsed.response) return parsed.response;

  // Verify the room exists
  const room = await prisma.room.findUnique({
    where: { id: parsed.data.roomId },
  });
  if (!room) {
    return NextResponse.json(
      { error: "Room not found with the given roomId" },
      { status: 400 },
    );
  }

  const rack = await prisma.rack.create({
    data: {
      name: parsed.data.name,
      roomId: parsed.data.roomId,
      rowLabel: parsed.data.rowLabel ?? null,
      sortOrder: parsed.data.sortOrder,
      totalUnits: parsed.data.totalUnits,
      maxPowerWatts: parsed.data.maxPowerWatts ?? null,
      positionX: parsed.data.positionX ?? null,
      positionY: parsed.data.positionY ?? null,
    },
    include: { room: true },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "Rack",
    entityId: rack.id,
    changes: {
      name: rack.name,
      roomId: rack.roomId,
      totalUnits: rack.totalUnits,
    },
  });

  return NextResponse.json(rack, { status: 201 });
}
