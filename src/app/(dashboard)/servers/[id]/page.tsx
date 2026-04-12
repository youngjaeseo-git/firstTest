export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ServerDetailClient } from "@/components/metrics/server-detail-client";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PowerConsoleCard } from "@/components/equipment/power-console-card";
import { getSessionUser, canControlPower } from "@/lib/rbac";

export default async function ServerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  const equipment = await prisma.equipment.findUnique({
    where: { id: params.id },
    include: {
      rack: { include: { room: { include: { dataCenter: true } } } },
      cpus: { orderBy: { socketIndex: "asc" } },
      memories: { orderBy: { slotIndex: "asc" } },
      prometheusTarget: true,
    },
  });

  if (!equipment) notFound();

  const instance =
    equipment.prometheusTarget?.instance ||
    equipment.prometheusInstance ||
    (equipment.ipAddress ? `${equipment.ipAddress}:9100` : null);

  const totalMemoryGb =
    equipment.totalMemoryGB ||
    equipment.memories
      .filter((m) => m.populated)
      .reduce((s, m) => s + (m.capacityGb || 0), 0);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div>
          <Breadcrumb
            items={[
              { label: "Servers", href: "/servers" },
              { label: equipment.hostname || "Unknown" },
            ]}
            className="mb-1"
          />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">
              {equipment.hostname || "Unnamed Server"}
            </h1>
            <div className="flex gap-2">
              <Link
                href={`/infrastructure/${equipment.id}`}
                className="rounded-lg border border-gray-700/60 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80 hover:border-gray-600 transition-all"
              >
                Equipment Detail
              </Link>
              <Link
                href={`/infrastructure/${equipment.id}/memory`}
                className="rounded-lg border border-gray-700/60 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80 hover:border-gray-600 transition-all"
              >
                Memory Detail
              </Link>
            </div>
          </div>
        </div>

        {/* Summary info bar */}
        <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "IP Address", value: equipment.ipAddress || "-", mono: true },
              { label: "Status", value: equipment.status },
              { label: "Model", value: equipment.model || "-" },
              {
                label: "Location",
                value: `${equipment.rack?.room?.name || "-"} / ${equipment.rack?.name || "-"}${equipment.rackPosition ? ` / U${equipment.rackPosition}` : ""}`,
              },
              {
                label: "CPUs",
                value:
                  equipment.cpus.length > 0
                    ? `${equipment.cpus.length}x ${equipment.cpus[0].model || "Unknown"}`
                    : "-",
              },
              { label: "Memory", value: `${totalMemoryGb} GB` },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {item.label}
                </p>
                <p className={`mt-1 text-gray-200 ${item.mono ? "font-mono" : ""}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Power & Console */}
        <PowerConsoleCard
          equipmentId={equipment.id}
          bmcHost={equipment.bmcIpAddress}
          hostname={equipment.hostname}
          canControl={!!user && canControlPower(user.role)}
        />

        {/* Metric charts */}
        {instance ? (
          <ServerDetailClient instance={instance} />
        ) : (
          <div className="rounded-xl border border-yellow-600/30 bg-yellow-500/5 p-8 text-center backdrop-blur-sm">
            <div className="rounded-xl bg-yellow-500/10 p-3 inline-block mb-3">
              <svg className="h-8 w-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="font-semibold text-yellow-300">Prometheus Not Configured</p>
            <p className="mt-1.5 text-sm text-yellow-400/70 max-w-md mx-auto">
              Sync targets in Settings → Discovery, or set the IP address on the equipment edit page.
            </p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
