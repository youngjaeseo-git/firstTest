export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { PageTransition } from "@/components/ui/page-transition";
import { MemoryInventoryClient } from "./memory-inventory-client";

export default async function MemoryInventoryPage() {
  const user = await getSessionUser();

  const servers = await prisma.equipment.findMany({
    where: { type: "SERVER" },
    include: {
      memories: {
        orderBy: { slotIndex: "asc" },
      },
    },
    orderBy: { hostname: "asc" },
  });

  const data = servers.map((s) => ({
    id: s.id,
    hostname: s.hostname,
    ipAddress: s.ipAddress,
    totalMemoryGB: s.totalMemoryGB,
    status: s.status,
    memories: s.memories.map((m) => ({
      id: m.id,
      slotName: m.slotName,
      slotIndex: m.slotIndex,
      populated: m.populated,
      capacityGb: m.capacityGb,
      memoryType: m.memoryType,
      manufacturer: m.manufacturer,
      partNumber: m.partNumber,
      serialNumber: m.serialNumber,
      speedMhz: m.speedMhz,
      rank: m.rank,
      formFactor: m.formFactor,
    })),
  }));

  return (
    <PageTransition>
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <MemoryInventoryClient servers={JSON.parse(JSON.stringify(data))} />
      </Suspense>
    </PageTransition>
  );
}
