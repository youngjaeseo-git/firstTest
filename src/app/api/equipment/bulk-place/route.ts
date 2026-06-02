import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

const PlacementItemSchema = z.object({
  equipmentId: z.string(),
  rackId: z.string(),
  rackPosition: z.number().int().min(1).max(100),
  rackHeight: z.number().int().min(1).max(10).optional(),
});

const BulkPlaceSchema = z.object({
  placements: z.array(PlacementItemSchema).min(1).max(100),
});

type PlacementItem = z.infer<typeof PlacementItemSchema>;

interface PlacementFailure {
  equipmentId: string;
  error: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" },
      { status: 403 },
    );
  }

  const parsed = await parseBody(req, BulkPlaceSchema);
  if (parsed.response) return parsed.response;
  const { placements } = parsed.data;

  const failed: PlacementFailure[] = [];
  let successCount = 0;

  // Pre-validate all placements before the transaction
  // 1. Collect all unique equipment and rack IDs
  const equipmentIds = Array.from(new Set(placements.map((p) => p.equipmentId)));
  const rackIds = Array.from(new Set(placements.map((p) => p.rackId)));

  // 2. Verify all equipment exist
  const existingEquipment = await prisma.equipment.findMany({
    where: { id: { in: equipmentIds } },
    select: { id: true },
  });
  const existingEquipmentIds = new Set(existingEquipment.map((e) => e.id));

  // 3. Verify all racks exist
  const existingRacks = await prisma.rack.findMany({
    where: { id: { in: rackIds } },
    select: { id: true, totalUnits: true },
  });
  const rackMap = new Map(existingRacks.map((r) => [r.id, r]));

  // 4. Get all existing equipment in the target racks for conflict checking
  const existingInRacks = await prisma.equipment.findMany({
    where: {
      rackId: { in: rackIds },
      rackPosition: { not: null },
    },
    select: { id: true, rackId: true, rackPosition: true, rackHeight: true },
  });

  // Build a map of occupied U positions per rack (excluding equipment being placed)
  const placedEquipmentIds = new Set(placements.map((p) => p.equipmentId));
  const rackOccupancy = new Map<string, Array<{ start: number; end: number; equipmentId: string }>>();
  for (const eq of existingInRacks) {
    if (placedEquipmentIds.has(eq.id)) continue; // Exclude equipment being placed
    if (!eq.rackId || eq.rackPosition === null) continue;
    if (!rackOccupancy.has(eq.rackId)) {
      rackOccupancy.set(eq.rackId, []);
    }
    rackOccupancy.get(eq.rackId)!.push({
      start: eq.rackPosition,
      end: eq.rackPosition + eq.rackHeight - 1,
      equipmentId: eq.id,
    });
  }

  // Also track positions claimed by earlier placements in this batch
  const batchOccupancy = new Map<string, Array<{ start: number; end: number; equipmentId: string }>>();

  // Separate valid and invalid placements
  const validPlacements: PlacementItem[] = [];

  for (const placement of placements) {
    // Check equipment exists
    if (!existingEquipmentIds.has(placement.equipmentId)) {
      failed.push({ equipmentId: placement.equipmentId, error: "Equipment not found" });
      continue;
    }

    // Check rack exists
    const rack = rackMap.get(placement.rackId);
    if (!rack) {
      failed.push({ equipmentId: placement.equipmentId, error: "Rack not found" });
      continue;
    }

    const height = placement.rackHeight ?? 1;
    const topU = placement.rackPosition + height - 1;

    // Check if placement exceeds rack capacity
    if (topU > rack.totalUnits) {
      failed.push({
        equipmentId: placement.equipmentId,
        error: `Position ${placement.rackPosition}-${topU}U exceeds rack capacity of ${rack.totalUnits}U`,
      });
      continue;
    }

    // Check for conflicts with existing equipment in the rack
    const existingSlots = rackOccupancy.get(placement.rackId) ?? [];
    const batchSlots = batchOccupancy.get(placement.rackId) ?? [];
    const allSlots = [...existingSlots, ...batchSlots];

    let conflict = false;
    for (const slot of allSlots) {
      // Two ranges overlap if start1 <= end2 AND start2 <= end1
      if (placement.rackPosition <= slot.end && slot.start <= topU) {
        failed.push({
          equipmentId: placement.equipmentId,
          error: `U position conflict at ${placement.rackPosition}-${topU}U with equipment ${slot.equipmentId}`,
        });
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    // Record this placement in batch occupancy for subsequent conflict checks
    if (!batchOccupancy.has(placement.rackId)) {
      batchOccupancy.set(placement.rackId, []);
    }
    batchOccupancy.get(placement.rackId)!.push({
      start: placement.rackPosition,
      end: topU,
      equipmentId: placement.equipmentId,
    });

    validPlacements.push(placement);
  }

  // Execute all valid placements in a transaction
  if (validPlacements.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const placement of validPlacements) {
        const updateData: { rackId: string; rackPosition: number; rackHeight?: number } = {
          rackId: placement.rackId,
          rackPosition: placement.rackPosition,
        };
        if (placement.rackHeight !== undefined) {
          updateData.rackHeight = placement.rackHeight;
        }

        await tx.equipment.update({
          where: { id: placement.equipmentId },
          data: updateData,
        });
      }
    });

    successCount = validPlacements.length;

    // Log audit entries outside the transaction (audit failures must not turn a
    // committed placement into a request error, so swallow per-entry failures).
    await Promise.allSettled(
      validPlacements.map((placement) =>
        logAudit({
          userId: user.id,
          action: "RACK_MOVE",
          entityType: "Equipment",
          entityId: placement.equipmentId,
          changes: {
            rackId: placement.rackId,
            rackPosition: placement.rackPosition,
            ...(placement.rackHeight !== undefined ? { rackHeight: placement.rackHeight } : {}),
          },
        }),
      ),
    );
  }

  return NextResponse.json({ success: successCount, failed });
}
