import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getSessionUser, canControlPower } from "@/lib/rbac";
import { PowerConsoleCard } from "@/components/equipment/power-console-card";
import { EquipmentHistory } from "@/components/equipment/equipment-history";
import { ServerDetailClient } from "@/components/metrics/server-detail-client";

export default async function EquipmentDetailPage({
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
      networkPorts: true,
      prometheusTarget: true,
    },
  });

  if (!equipment) notFound();

  const populatedMemory = equipment.memories.filter((m) => m.populated);
  const totalMemoryGb = populatedMemory.reduce(
    (s, m) => s + (m.capacityGb || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/infrastructure" className="hover:text-gray-200">
              Infrastructure
            </Link>
            <span>/</span>
            <span>{equipment.hostname || equipment.serialNumber}</span>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            {equipment.hostname || "Unnamed Equipment"}
            <StatusBadge status={equipment.status} />
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/infrastructure/${equipment.id}/memory`}>
            <Button variant="outline">Memory 상세</Button>
          </Link>
          {user?.role === "ADMIN" && (
            <Link href={`/infrastructure/${equipment.id}/edit`}>
              <Button>편집</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-6">
          {[
            { label: "IP Address", value: equipment.ipAddress || "-", mono: true },
            { label: "Status", value: equipment.status },
            { label: "Model", value: equipment.model || equipment.manufacturer || "-" },
            {
              label: "Location",
              value: equipment.rack
                ? `${equipment.rack.room.name} / ${equipment.rack.name}${equipment.rackPosition ? ` / U${equipment.rackPosition}` : ""}`
                : "미배치",
            },
            {
              label: "CPUs",
              value:
                equipment.cpus.length > 0
                  ? `${equipment.cpus.length}x ${equipment.cpus[0].model || "Unknown"}`
                  : "-",
            },
            {
              label: "Memory",
              value:
                (equipment.totalMemoryGB || totalMemoryGb) > 0
                  ? `${equipment.totalMemoryGB || totalMemoryGb} GB`
                  : "-",
            },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                {item.label}
              </p>
              <p className={`mt-1 text-gray-200 ${"mono" in item && item.mono ? "font-mono" : ""}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Power & Console — only meaningful for SERVER type with BMC */}
      {equipment.type === "SERVER" && (
        <PowerConsoleCard
          equipmentId={equipment.id}
          bmcHost={equipment.bmcIpAddress}
          hostname={equipment.hostname}
          canControl={!!user && canControlPower(user.role)}
        />
      )}

      {/* Prometheus Metrics */}
      {(() => {
        const instance =
          equipment.prometheusInstance ||
          equipment.prometheusTarget?.instance ||
          null;
        return instance ? (
          <ServerDetailClient instance={instance} />
        ) : (
          <Card>
            <p className="text-sm text-gray-500">
              Prometheus 연결 정보가 없습니다. Discovery에서 타겟을 등록하면 메트릭이 표시됩니다.
            </p>
          </Card>
        );
      })()}

      {/* Collapsible sections */}
      <Accordion type="multiple" defaultValue={["basic", "cpu", "memory"]}>
        {/* Basic Info */}
        <AccordionItem value="basic">
          <AccordionTrigger>
            <CardTitle>기본 정보</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
              {[
                ["제조사", equipment.manufacturer],
                ["모델", equipment.model],
                ["시리얼번호", equipment.serialNumber],
                ["자산태그", equipment.assetTag],
                ["OS", equipment.osType ? `${equipment.osType} ${equipment.osVersion || ""}` : null],
                ["BIOS", equipment.biosVersion],
                ["BMC IP", equipment.bmcIpAddress],
                ["구매일", equipment.purchaseDate?.toLocaleDateString("ko-KR")],
                ["보증만료", equipment.warrantyExpiry?.toLocaleDateString("ko-KR")],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span className="text-gray-400">{label}</span>
                  <p className="mt-0.5 text-gray-200">{(value as string) || "-"}</p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* CPU Info */}
        <AccordionItem value="cpu">
          <AccordionTrigger>
            <CardTitle>CPU ({equipment.cpus.length} Socket)</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            {equipment.cpus.length === 0 ? (
              <p className="text-gray-500">CPU 정보가 등록되지 않았습니다.</p>
            ) : (
              <div className="space-y-3">
                {equipment.cpus.map((cpu) => (
                  <Card key={cpu.id} className="bg-gray-800/50 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                      <div>
                        <span className="text-gray-400">Socket {cpu.socketIndex}</span>
                        <p className="font-medium text-gray-100">{cpu.model || "-"}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Cores / Threads</span>
                        <p className="text-gray-200">
                          {cpu.cores || "-"} / {cpu.threads || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Clock</span>
                        <p className="text-gray-200">
                          {cpu.baseFreqMhz ? `${cpu.baseFreqMhz} MHz` : "-"}
                          {cpu.maxFreqMhz ? ` (max ${cpu.maxFreqMhz} MHz)` : ""}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">TDP</span>
                        <p className="text-gray-200">
                          {cpu.tdpWatts ? `${cpu.tdpWatts}W` : "-"}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Memory Overview */}
        <AccordionItem value="memory">
          <AccordionTrigger>
            <CardTitle>
              Memory ({populatedMemory.length}/{equipment.memories.length} Slots,{" "}
              {totalMemoryGb} GB)
            </CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            {equipment.memories.length === 0 ? (
              <p className="text-gray-500">메모리 정보가 등록되지 않았습니다.</p>
            ) : (
              <div>
                <div className="mb-3 flex gap-4 text-sm">
                  <span className="text-gray-400">
                    Types:{" "}
                    {Array.from(new Set(populatedMemory.map((m) => m.memoryType).filter(Boolean))).join(", ") || "-"}
                  </span>
                  <span className="text-gray-400">
                    Manufacturers:{" "}
                    {Array.from(new Set(populatedMemory.map((m) => m.manufacturer).filter(Boolean))).join(", ") || "-"}
                  </span>
                </div>
                <Link href={`/infrastructure/${equipment.id}/memory`}>
                  <Button variant="outline" size="sm">
                    Memory 상세 페이지 보기 →
                  </Button>
                </Link>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Change History */}
        <AccordionItem value="history">
          <AccordionTrigger>
            <CardTitle>변경 이력</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <EquipmentHistory equipmentId={equipment.id} />
          </AccordionContent>
        </AccordionItem>

        {/* Network Ports */}
        <AccordionItem value="network">
          <AccordionTrigger>
            <CardTitle>
              Network Ports ({equipment.networkPorts.length})
            </CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            {equipment.networkPorts.length === 0 ? (
              <p className="text-gray-500">네트워크 포트 정보가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                {equipment.networkPorts.map((port) => (
                  <Card key={port.id} className="bg-gray-800/50 p-3">
                    <p className="font-medium">{port.name}</p>
                    <p className="text-xs text-gray-400">
                      {port.speed || "-"} /{" "}
                      {port.connected ? "Connected" : "Disconnected"}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
