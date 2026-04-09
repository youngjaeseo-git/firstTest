export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ServerDetailClient } from "@/components/metrics/server-detail-client";

export default async function ServerDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  // Determine Prometheus instance label
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/servers" className="hover:text-gray-200">
            Servers
          </Link>
          <span>/</span>
          <span>{equipment.hostname || "Unknown"}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {equipment.hostname || "Unnamed Server"}
          </h1>
          <div className="flex gap-2">
            <Link
              href={`/infrastructure/${equipment.id}`}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Equipment Detail
            </Link>
            <Link
              href={`/infrastructure/${equipment.id}/memory`}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Memory Detail
            </Link>
          </div>
        </div>
      </div>

      {/* Summary info bar */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-6">
          <div>
            <p className="text-xs text-gray-500">IP Address</p>
            <p className="mt-0.5 font-mono">{equipment.ipAddress || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <p className="mt-0.5">{equipment.status}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Model</p>
            <p className="mt-0.5">{equipment.model || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Location</p>
            <p className="mt-0.5">
              {equipment.rack?.room?.name || "-"} /{" "}
              {equipment.rack?.name || "-"}
              {equipment.rackPosition ? ` / U${equipment.rackPosition}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CPUs</p>
            <p className="mt-0.5">
              {equipment.cpus.length > 0
                ? `${equipment.cpus.length}x ${equipment.cpus[0].model || "Unknown"}`
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Memory</p>
            <p className="mt-0.5">{totalMemoryGb} GB</p>
          </div>
        </div>
      </div>

      {/* Metric charts (client component) */}
      {instance ? (
        <ServerDetailClient instance={instance} />
      ) : (
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-500/5 p-6 text-center text-sm text-yellow-300">
          <p className="font-medium">Prometheus instance가 설정되지 않았습니다</p>
          <p className="mt-1 text-yellow-400/80">
            Settings → Discovery에서 타겟을 동기화하거나, 장비 수정 페이지에서 IP를 입력하세요.
          </p>
        </div>
      )}
    </div>
  );
}
