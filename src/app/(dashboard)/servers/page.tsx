export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ServerPageClient } from "@/components/twin/server-page-client";

export default async function ServersPage() {
  const rooms = await prisma.room.findMany({
    include: {
      racks: {
        include: {
          equipment: {
            where: { type: "SERVER" },
            include: { cpus: true },
            orderBy: { rackPosition: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Flatten servers for list view
  const servers = rooms.flatMap((room) =>
    room.racks.flatMap((rack) =>
      rack.equipment.map((eq) => ({
        ...eq,
        roomName: room.name,
        rackName: rack.name,
      })),
    ),
  );

  return (
    <ServerPageClient
      rooms={JSON.parse(JSON.stringify(rooms))}
      servers={JSON.parse(JSON.stringify(servers))}
    />
  );
}
