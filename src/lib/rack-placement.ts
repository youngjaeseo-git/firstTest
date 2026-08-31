import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface RackPlacementConflict {
  ok: false;
  error: string;
}
export interface RackPlacementOk {
  ok: true;
}
export type RackPlacementResult = RackPlacementOk | RackPlacementConflict;

/**
 * Validate that an equipment can occupy [rackPosition, rackPosition+rackHeight-1]
 * in the given rack without exceeding capacity or overlapping other equipment.
 *
 * Pass `excludeEquipmentId` to ignore the equipment being moved (so moving it
 * within the same rack doesn't conflict with itself).
 *
 * Run this inside the same transaction as the update for atomicity.
 */
export async function checkRackPlacement(
  tx: TxClient,
  params: {
    rackId: string;
    rackPosition: number;
    rackHeight: number;
    excludeEquipmentId?: string;
  },
): Promise<RackPlacementResult> {
  const { rackId, rackPosition, rackHeight, excludeEquipmentId } = params;

  if (rackPosition < 1) {
    return { ok: false, error: `U 위치는 1 이상이어야 합니다 (입력: ${rackPosition})` };
  }

  const rack = await tx.rack.findUnique({
    where: { id: rackId },
    select: { totalUnits: true, name: true },
  });
  if (!rack) {
    return { ok: false, error: "랙을 찾을 수 없습니다" };
  }

  const topU = rackPosition + rackHeight - 1;
  if (topU > rack.totalUnits) {
    return {
      ok: false,
      error: `U${rackPosition}-${topU}는 랙 용량(${rack.totalUnits}U)을 초과합니다`,
    };
  }

  const occupants = await tx.equipment.findMany({
    where: {
      rackId,
      rackPosition: { not: null },
      ...(excludeEquipmentId ? { id: { not: excludeEquipmentId } } : {}),
    },
    select: { id: true, hostname: true, rackPosition: true, rackHeight: true },
  });

  for (const occ of occupants) {
    if (occ.rackPosition === null) continue;
    const occTop = occ.rackPosition + occ.rackHeight - 1;
    // Two ranges overlap if start1 <= end2 AND start2 <= end1
    if (rackPosition <= occTop && occ.rackPosition <= topU) {
      const label = occ.hostname || occ.id;
      return {
        ok: false,
        error: `U${rackPosition}-${topU} 위치가 ${label}(U${occ.rackPosition}-${occTop})와 겹칩니다`,
      };
    }
  }

  return { ok: true };
}
