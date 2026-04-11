export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ServerCompareClient } from "@/components/metrics/server-compare-client";
import { PageTransition } from "@/components/ui/page-transition";

export default async function ServerComparePage() {
  const servers = await prisma.equipment.findMany({
    where: { type: "SERVER" },
    include: {
      prometheusTarget: true,
      rack: { include: { room: true } },
    },
    orderBy: { hostname: "asc" },
  });

  const serverList = servers.map((s) => ({
    id: s.id,
    hostname: s.hostname || s.ipAddress || "Unknown",
    ipAddress: s.ipAddress,
    instance:
      s.prometheusTarget?.instance ||
      s.prometheusInstance ||
      (s.ipAddress ? `${s.ipAddress}:9100` : null),
    room: s.rack?.room?.name || null,
    rack: s.rack?.name || null,
    status: s.status,
  }));

  return (
    <PageTransition>
      <ServerCompareClient servers={serverList} />
    </PageTransition>
  );
}
