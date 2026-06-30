import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { CreateEquipmentSchema } from "@/lib/schemas/equipment";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const roomId = searchParams.get("roomId");
  const search = searchParams.get("search");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") || "50") || 50),
  );

  const unracked = searchParams.get("unracked");

  const where: Record<string, unknown> = {};

  // Organization-based filtering: non-ADMIN users only see equipment in their orgs
  if (user.role !== "ADMIN") {
    const memberships = await prisma.userOrganization.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    where.organizationId = { in: orgIds };
  }

  if (unracked === "true") where.rackId = null;
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

  const parsed = await parseBody(req, CreateEquipmentSchema);
  if (parsed.response) return parsed.response;
  const { cpus, memories, organizationId: bodyOrgId, ...equipmentData } = parsed.data as typeof parsed.data & { organizationId?: string };

  // Determine organizationId: use provided value, or auto-assign for non-ADMIN
  let resolvedOrgId: string | null = bodyOrgId ?? null;
  // Non-ADMIN may only assign an org they belong to (prevents cross-org creation).
  if (resolvedOrgId && user.role !== "ADMIN") {
    const membership = await prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: resolvedOrgId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden — 소속되지 않은 조직입니다" }, { status: 403 });
    }
  }
  if (!resolvedOrgId && user.role !== "ADMIN") {
    const firstMembership = await prisma.userOrganization.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { joinedAt: "asc" },
    });
    resolvedOrgId = firstMembership?.organizationId ?? null;
  }

  const equipment = await prisma.equipment.create({
    data: {
      ...equipmentData,
      organizationId: resolvedOrgId,
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
