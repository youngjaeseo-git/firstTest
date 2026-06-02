import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit, canDelete } from "@/lib/rbac";
import { logAudit, diffShallow } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { UpdateEquipmentSchema } from "@/lib/schemas/equipment";
import { checkRackPlacement } from "@/lib/rack-placement";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      rack: { include: { room: { include: { dataCenter: true } } } },
      cpus: { orderBy: { socketIndex: "asc" } },
      memories: { orderBy: { slotIndex: "asc" } },
      networkPorts: true,
      prometheusTarget: true,
    },
  });

  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(equipment);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" },
      { status: 403 },
    );
  }

  const parsed = await parseBody(req, UpdateEquipmentSchema);
  if (parsed.response) return parsed.response;
  const { cpus, memories: _memories, ...equipmentData } = parsed.data;

  const before = await prisma.equipment.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolve effective rack placement after merging the partial update with
  // current values, then validate position/capacity/overlap server-side.
  const data = equipmentData as Record<string, unknown>;
  const effectiveRackId =
    "rackId" in data ? (data.rackId as string | null) : before.rackId;
  const effectiveRackPosition =
    "rackPosition" in data
      ? (data.rackPosition as number | null)
      : before.rackPosition;
  const effectiveRackHeight =
    "rackHeight" in data ? (data.rackHeight as number) : before.rackHeight;

  let conflictError: string | null = null;

  const equipment = await prisma.$transaction(async (tx) => {
    if (effectiveRackId && effectiveRackPosition != null) {
      const check = await checkRackPlacement(tx, {
        rackId: effectiveRackId,
        rackPosition: effectiveRackPosition,
        rackHeight: effectiveRackHeight ?? 1,
        excludeEquipmentId: id,
      });
      if (!check.ok) {
        conflictError = check.error;
        return null;
      }
    }

    if (cpus) {
      await tx.equipmentCpu.deleteMany({ where: { equipmentId: id } });
      if (cpus.length > 0) {
        await tx.equipmentCpu.createMany({
          data: cpus.map((c) => ({
            ...c,
            equipmentId: id,
          })),
        });
      }
    }

    return tx.equipment.update({
      where: { id },
      data: equipmentData,
      include: { cpus: true, memories: true, rack: true },
    });
  });

  if (conflictError || !equipment) {
    return NextResponse.json(
      { error: conflictError ?? "Update failed" },
      { status: 409 },
    );
  }

  if (before) {
    const changes = diffShallow(
      before as unknown as Record<string, unknown>,
      equipment as unknown as Record<string, unknown>,
    );
    const changedKeys = Object.keys(changes).filter(
      (k) => !["updatedAt", "createdAt"].includes(k),
    );
    if (changedKeys.length > 0) {
      await logAudit({
        userId: user.id,
        action: "UPDATE",
        entityType: "Equipment",
        entityId: id,
        changes: Object.fromEntries(changedKeys.map((k) => [k, changes[k]])),
      });
    }
  }

  return NextResponse.json(equipment);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canDelete(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 권한 필요" },
      { status: 403 },
    );
  }

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body.reason;
  } catch {
    // no body is fine
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: { hostname: true, ipAddress: true, serialNumber: true, type: true },
  });

  await prisma.equipment.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "Equipment",
    entityId: id,
    changes: equipment ? { ...equipment } : undefined,
    reason,
  });

  return NextResponse.json({ success: true });
}
