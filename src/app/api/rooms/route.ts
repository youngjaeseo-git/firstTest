export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { CreateRoomSchema } from "@/lib/schemas/room";

export async function GET() {
  const rooms = await prisma.room.findMany({
    include: {
      dataCenter: true,
      racks: {
        include: {
          _count: { select: { equipment: true } },
          equipment: {
            select: { rackPosition: true, rackHeight: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(rooms);
}

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

  const parsed = await parseBody(req, CreateRoomSchema);
  if (parsed.response) return parsed.response;

  // Use the first (and only) DataCenter
  const dataCenter = await prisma.dataCenter.findFirst();
  if (!dataCenter) {
    return NextResponse.json(
      { error: "No DataCenter found. Please create a DataCenter first." },
      { status: 400 },
    );
  }

  const room = await prisma.room.create({
    data: {
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
      description: parsed.data.description ?? null,
      dataCenterId: dataCenter.id,
    },
    include: { dataCenter: true, racks: true },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "Room",
    entityId: room.id,
    changes: {
      name: room.name,
      sortOrder: room.sortOrder,
      dataCenterId: room.dataCenterId,
    },
  });

  return NextResponse.json(room, { status: 201 });
}
