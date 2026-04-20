export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { ServerPageClient } from "@/components/twin/server-page-client";
import { PageTransition } from "@/components/ui/page-transition";

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

  const unrackedServers = await prisma.equipment.findMany({
    where: { type: "SERVER", rackId: null },
    include: { cpus: true },
    orderBy: { hostname: "asc" },
  });

  // Flatten servers for list view
  const servers = [
    ...rooms.flatMap((room) =>
      room.racks.flatMap((rack) =>
        rack.equipment.map((eq) => ({
          id: eq.id,
          hostname: eq.hostname,
          ipAddress: eq.ipAddress,
          bmcIpAddress: eq.bmcIpAddress,
          status: eq.status,
          type: eq.type,
          model: eq.model,
          manufacturer: eq.manufacturer,
          cpuManufacturer: eq.cpus[0]?.manufacturer || null,
          cpuModel: eq.cpus[0]?.model || null,
          totalMemoryGB: eq.totalMemoryGB,
          rackPosition: eq.rackPosition,
          roomName: room.name,
          rackName: rack.name,
        })),
      ),
    ),
    ...unrackedServers.map((eq) => ({
      id: eq.id,
      hostname: eq.hostname,
      ipAddress: eq.ipAddress,
      bmcIpAddress: eq.bmcIpAddress,
      status: eq.status,
      type: eq.type,
      model: eq.model,
      manufacturer: eq.manufacturer,
      cpuManufacturer: eq.cpus[0]?.manufacturer || null,
      cpuModel: eq.cpus[0]?.model || null,
      totalMemoryGB: eq.totalMemoryGB,
      rackPosition: eq.rackPosition,
      roomName: null,
      rackName: "미배치",
    })),
  ];

  return (
    <PageTransition>
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <ServerPageClient
          rooms={JSON.parse(JSON.stringify(rooms))}
          servers={JSON.parse(JSON.stringify(servers))}
        />
      </Suspense>
    </PageTransition>
  );
}
