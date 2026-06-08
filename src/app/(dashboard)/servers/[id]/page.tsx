export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ServerDetailClient } from "@/components/metrics/server-detail-client";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { PowerConsoleCard } from "@/components/equipment/power-console-card";
import { RefreshHwButton } from "@/components/equipment/refresh-hw-button";
import { BmcSensorsCard } from "@/components/equipment/bmc-sensors-card";
import { MemorySlotDiagram } from "@/components/memory/memory-slot-diagram";
import { PowerStateIndicator } from "@/components/metrics/power-state-indicator";
import { getSessionUser, canControlPower } from "@/lib/rbac";
import { EquipmentAssignments } from "@/components/equipment/equipment-assignments";

export default async function ServerDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id;
  if (!id) notFound();

  const user = await getSessionUser();
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      rack: { include: { room: { include: { dataCenter: true } } } },
      cpus: { orderBy: { socketIndex: "asc" } },
      memories: { orderBy: { slotIndex: "asc" } },
      prometheusTarget: true,
    },
  });

  if (!equipment) notFound();

  const instance =
    equipment.prometheusInstance ||
    equipment.prometheusTarget?.instance ||
    (equipment.ipAddress ? `${equipment.ipAddress}:10250` : null);

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
              {equipment.bmcIpAddress && (
                <RefreshHwButton equipmentId={equipment.id} />
              )}
              <Link
                href={`/infrastructure/${equipment.id}`}
                className="rounded-lg border border-gray-700/60 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80 hover:border-gray-600 transition-all"
              >
                자산 관리
              </Link>
            </div>
          </div>
        </div>

        {/* Summary info bar */}
        <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-6">
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">IP Address</p>
              <p className="mt-1 font-mono text-gray-200">{equipment.ipAddress || "-"}</p>
            </div>
            {equipment.bmcIpAddress && (
              <div>
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">BMC IP</p>
                <p className="mt-1 font-mono text-gray-200">{equipment.bmcIpAddress}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={equipment.status} />
                <PowerStateIndicator hostname={equipment.hostname} ipAddress={equipment.ipAddress} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Model</p>
              <p className="mt-1 text-gray-200">{equipment.model || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Location</p>
              <p className="mt-1 text-gray-200">
                {`${equipment.rack?.room?.name || "-"} / ${equipment.rack?.name || "-"}${equipment.rackPosition ? ` / U${equipment.rackPosition}` : ""}`}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">CPUs</p>
              <p className="mt-1 text-gray-200">
                {equipment.cpus.length > 0
                  ? `${equipment.cpus.length}x ${equipment.cpus[0].model || "Unknown"}`
                  : "-"}
              </p>
              {equipment.cpus[0]?.architecture && (
                <p className="text-[10px] text-gray-500">{equipment.cpus[0].architecture}</p>
              )}
            </div>
            {(equipment.osType || equipment.osVersion) && (
              <div>
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">OS</p>
                <p className="mt-1 text-gray-200">{equipment.osType || "-"}</p>
                {equipment.osVersion && (
                  <p className="text-[10px] text-gray-500">{equipment.osVersion}</p>
                )}
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Memory</p>
              <p className="mt-1 text-gray-200">{totalMemoryGb} GB</p>
              {(() => {
                const populatedDimms = equipment.memories.filter(m => m.populated);
                const speed = populatedDimms.find(m => m.speedMhz)?.speedMhz;
                const dimmCount = populatedDimms.length;
                const totalSlots = equipment.memories.length;
                return (dimmCount > 0 || speed) ? (
                  <p className="text-[10px] text-gray-500">
                    {dimmCount > 0 && `${dimmCount}/${totalSlots} DIMM`}
                    {speed ? ` ${speed} MHz` : ""}
                  </p>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {/* Assignment tracking */}
        <EquipmentAssignments equipmentId={equipment.id} />

        {/* Power & Console */}
        <PowerConsoleCard
          equipmentId={equipment.id}
          bmcHost={equipment.bmcIpAddress}
          hostname={equipment.hostname}
          canControl={!!user && canControlPower(user.role)}
        />

        {/* BMC Sensors (Thermal & Power) */}
        {equipment.bmcIpAddress && (
          <BmcSensorsCard equipmentId={equipment.id} />
        )}

        {/* Memory Summary */}
        {equipment.memories.length > 0 && (() => {
          const populated = equipment.memories.filter((m) => m.populated);
          const memCapacity = populated.reduce((s, m) => s + (m.capacityGb || 0), 0);
          const memTypes = Array.from(new Set(populated.map((m) => m.memoryType).filter(Boolean)));
          const manufacturers = Array.from(new Set(populated.map((m) => m.manufacturer).filter(Boolean)));
          const maxSpeed = Math.max(...populated.map((m) => m.speedMhz || 0), 0);
          return (
            <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Memory</h3>
                <Link
                  href={`/infrastructure/${equipment.id}/memory`}
                  className="rounded-lg border border-gray-700/60 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
                >
                  상세 / 편집 →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                <div>
                  <p className="text-[11px] text-gray-500">Total Capacity</p>
                  <p className="mt-1 text-lg font-bold text-blue-400">{memCapacity} GB</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">DIMM Slots</p>
                  <p className="mt-1 text-gray-200">
                    <span className="text-green-400 font-bold">{populated.length}</span>
                    <span className="text-gray-500"> / {equipment.memories.length}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Type</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {memTypes.length > 0
                      ? memTypes.map((t) => <Badge key={t} variant="info">{t}</Badge>)
                      : <span className="text-gray-500">-</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Manufacturer</p>
                  <p className="mt-1 text-gray-200 text-xs">{manufacturers.join(", ") || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Max Speed</p>
                  <p className="mt-1 text-gray-200">{maxSpeed > 0 ? `${maxSpeed} MHz` : "-"}</p>
                </div>
              </div>
              <MemorySlotDiagram memories={equipment.memories.map((m) => ({
                slotName: m.slotName,
                populated: m.populated,
                capacityGb: m.capacityGb,
                memoryType: m.memoryType,
              }))} cpuCount={equipment.cpus.length} />
            </div>
          );
        })()}

        {/* Metric charts */}
        {instance ? (
          <ServerDetailClient instance={instance} hostIp={equipment.ipAddress || undefined} />
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
