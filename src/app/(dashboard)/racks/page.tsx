export const revalidate = 30;

import { prisma } from "@/lib/db";
import { RacksPageClient } from "@/components/racks/rack-detail-view";

export default async function RacksPage() {
  const racks = await prisma.rack.findMany({
    include: {
      room: true,
      equipment: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          status: true,
          rackPosition: true,
          rackHeight: true,
          type: true,
          model: true,
          manufacturer: true,
        },
      },
      pdus: true,
    },
    orderBy: [{ room: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  // Group by room
  const byRoom = racks.reduce(
    (acc, rack) => {
      const key = rack.room.id;
      if (!acc[key]) {
        acc[key] = { roomName: rack.room.name, racks: [] as typeof racks };
      }
      acc[key].racks.push(rack);
      return acc;
    },
    {} as Record<string, { roomName: string; racks: typeof racks }>,
  );

  const totalRacks = racks.length;
  const totalEquipment = racks.reduce((s, r) => s + r.equipment.length, 0);
  const totalUnits = racks.reduce((s, r) => s + r.totalUnits, 0);
  const usedUnits = racks.reduce(
    (s, r) =>
      s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0),
    0,
  );
  const utilization =
    totalUnits > 0 ? Math.round((usedUnits / totalUnits) * 100) : 0;

  // Serialize for client component
  const roomGroups = Object.entries(byRoom).map(
    ([roomId, { roomName, racks: roomRacks }]) => ({
      roomId,
      roomName,
      racks: roomRacks.map((rack) => ({
        id: rack.id,
        name: rack.name,
        rowLabel: rack.rowLabel,
        totalUnits: rack.totalUnits,
        maxPowerWatts: rack.maxPowerWatts,
        equipment: rack.equipment.map((eq) => ({
          id: eq.id,
          hostname: eq.hostname,
          ipAddress: eq.ipAddress,
          status: eq.status,
          rackPosition: eq.rackPosition,
          rackHeight: eq.rackHeight,
          type: eq.type,
          model: eq.model,
          manufacturer: eq.manufacturer,
        })),
      })),
    }),
  );

  return (
    <RacksPageClient
      roomGroups={roomGroups}
      totalRacks={totalRacks}
      totalEquipment={totalEquipment}
      totalUnits={totalUnits}
      usedUnits={usedUnits}
      utilization={utilization}
      roomCount={Object.keys(byRoom).length}
    />
  );
}
