import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const roomId = searchParams.get("roomId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (roomId) where.rack = { roomId };
  if (search) {
    where.OR = [
      { hostname: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search } },
      { serialNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      include: {
        rack: { include: { room: true } },
        cpus: true,
        _count: { select: { memories: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.equipment.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, limit });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
  }

  const body = await req.json();
  const { cpus, memories, ...equipmentData } = body;

  const equipment = await prisma.equipment.create({
    data: {
      ...equipmentData,
      cpus: cpus ? { create: cpus } : undefined,
      memories: memories ? { create: memories } : undefined,
    },
    include: { cpus: true, memories: true, rack: true },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "Equipment",
    entityId: equipment.id,
    changes: {
      hostname: equipment.hostname,
      ipAddress: equipment.ipAddress,
      type: equipment.type,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
    },
  });

  return NextResponse.json(equipment, { status: 201 });
}
