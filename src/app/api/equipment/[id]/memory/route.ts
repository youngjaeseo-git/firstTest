import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/api-validation";
import { MemorySchema } from "@/lib/schemas/equipment";

// slotIndex is reassigned server-side from array position, so it's optional on input.
const MemoryConfigSchema = z.object({
  memories: z.array(MemorySchema.omit({ slotIndex: true })).max(1024),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Org-based access check
  const eq = await prisma.equipment.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!eq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && (!eq.organizationId || !user.orgIds?.includes(eq.organizationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const memories = await prisma.equipmentMemory.findMany({
    where: { equipmentId: id },
    orderBy: { slotIndex: "asc" },
  });

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: { cpus: { orderBy: { socketIndex: "asc" } } },
  });

  const populated = memories.filter((m) => m.populated);
  const summary = {
    totalSlots: memories.length,
    populatedSlots: populated.length,
    emptySlots: memories.length - populated.length,
    totalCapacityGb: populated.reduce((sum, m) => sum + (m.capacityGb || 0), 0),
    memoryTypes: Array.from(new Set(populated.map((m) => m.memoryType).filter(Boolean))),
    manufacturers: Array.from(new Set(populated.map((m) => m.manufacturer).filter(Boolean))),
    maxSpeedMhz: Math.max(...populated.map((m) => m.speedMhz || 0), 0) || null,
    eccEnabled: populated.some((m) => m.eccEnabled),
  };

  return NextResponse.json({ memories, cpus: equipment?.cpus || [], summary });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Org-based access check
  const eq = await prisma.equipment.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!eq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && (!eq.organizationId || !user.orgIds?.includes(eq.organizationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, MemoryConfigSchema);
  if (parsed.response) return parsed.response;
  const { memories } = parsed.data;

  const beforeCount = await prisma.equipmentMemory.count({ where: { equipmentId: id } });

  await prisma.equipmentMemory.deleteMany({
    where: { equipmentId: id },
  });

  if (memories.length > 0) {
    await prisma.equipmentMemory.createMany({
      data: memories.map((m, i) => ({
        ...m,
        equipmentId: id,
        slotIndex: i,
      })),
    });
  }

  const populatedSlots = memories.filter((m) => m.populated);
  const totalGb = populatedSlots.reduce(
    (sum, m) => sum + (m.capacityGb || 0),
    0,
  );
  await prisma.equipment.update({
    where: { id },
    data: { totalMemoryGB: Math.round(totalGb) },
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Equipment",
    entityId: id,
    changes: {
      memoryConfig: {
        slotsBefore: beforeCount,
        slotsAfter: memories?.length || 0,
        populated: populatedSlots.length,
        totalCapacityGb: Math.round(totalGb),
      },
    },
  });

  return NextResponse.json({ success: true });
}
