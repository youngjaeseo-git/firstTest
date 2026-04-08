import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const rack = await prisma.rack.findUnique({
    where: { id: params.id },
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
