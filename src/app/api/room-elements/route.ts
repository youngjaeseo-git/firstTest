export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { CreateRoomElementSchema } from "@/lib/schemas/room-element";

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

  const parsed = await parseBody(req, CreateRoomElementSchema);
  if (parsed.response) return parsed.response;

  const room = await prisma.room.findUnique({
    where: { id: parsed.data.roomId },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 400 });
  }

  const { metadata, ...rest } = parsed.data;
  const element = await prisma.roomElement.create({
    data: {
      ...rest,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "RoomElement",
    entityId: element.id,
    changes: { type: element.type, name: element.name, roomId: element.roomId },
  });

  return NextResponse.json(element, { status: 201 });
}
