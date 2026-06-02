export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { RackManageClient } from "@/components/racks/rack-manage-client";
import { BulkPlacePanel } from "@/components/racks/bulk-place-panel";
import { RackManageTabs } from "@/components/racks/rack-manage-tabs";

export default async function RackManagePage() {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/racks");

  const rooms = await prisma.room.findMany({
    include: {
      racks: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { equipment: true } } },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const serialized = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    sortOrder: r.sortOrder,
    racks: r.racks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      rowLabel: rack.rowLabel,
      sortOrder: rack.sortOrder,
      totalUnits: rack.totalUnits,
      maxPowerWatts: rack.maxPowerWatts,
      positionX: rack.positionX,
      positionY: rack.positionY,
      equipmentCount: rack._count.equipment,
    })),
  }));

  const rackOptions = rooms.flatMap((r) =>
    r.racks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      roomName: r.name,
      totalUnits: rack.totalUnits,
    })),
  );

  return (
    <RackManageTabs
      manageTab={<RackManageClient rooms={serialized} />}
      bulkTab={<BulkPlacePanel racks={rackOptions} />}
    />
  );
}
