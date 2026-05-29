"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/i18n-context";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronDown, ChevronRight, Server, MemoryStick } from "lucide-react";

interface MemorySlot {
  id: string;
  slotName: string;
  slotIndex: number;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  serialNumber: string | null;
  speedMhz: number | null;
  rank: number | null;
  formFactor: string | null;
}

interface ServerData {
  id: string;
  hostname: string;
  ipAddress: string | null;
  totalMemoryGB: number | null;
  status: string;
  memories: MemorySlot[];
}

interface Props {
  servers: ServerData[];
}

function statusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "text-green-400";
    case "MAINTENANCE":
      return "text-yellow-400";
    case "FAILED":
      return "text-red-400";
    case "REPAIR":
      return "text-orange-400";
    default:
      return "text-gray-400";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-400";
    case "MAINTENANCE":
      return "bg-yellow-400";
    case "FAILED":
      return "bg-red-400";
    case "REPAIR":
      return "bg-orange-400";
    default:
      return "bg-gray-400";
  }
}

export function MemoryInventoryClient({ servers }: Props) {
  const t = useT();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Compute summary stats
  const totalServers = servers.length;
  const totalDimmsInstalled = servers.reduce(
    (acc, s) => acc + s.memories.filter((m) => m.populated).length,
    0,
  );
  const totalCapacityGB = servers.reduce(
    (acc, s) =>
      acc +
      s.memories
        .filter((m) => m.populated && m.capacityGb)
        .reduce((sum, m) => sum + (m.capacityGb || 0), 0),
    0,
  );

  // Most common memory type
  const typeCounts: Record<string, number> = {};
  servers.forEach((s) =>
    s.memories.forEach((m) => {
      if (m.populated && m.memoryType) {
        typeCounts[m.memoryType] = (typeCounts[m.memoryType] || 0) + 1;
      }
    }),
  );
  const mostCommonType =
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "--";

  // Filter servers
  const filtered = filter
    ? servers.filter(
        (s) =>
          s.hostname.toLowerCase().includes(filter.toLowerCase()) ||
          (s.ipAddress && s.ipAddress.toLowerCase().includes(filter.toLowerCase())),
      )
    : servers;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={MemoryStick}
        title={t("memoryInv.title")}
        subtitle={t("memoryInv.description")}
        accent="cyan"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={t("memoryInv.totalServers")}
          value={String(totalServers)}
          icon={<Server className="h-5 w-5 text-blue-400" />}
        />
        <SummaryCard
          label={t("memoryInv.totalDimms")}
          value={String(totalDimmsInstalled)}
          icon={<MemoryStick className="h-5 w-5 text-green-400" />}
        />
        <SummaryCard
          label={t("memoryInv.totalCapacity")}
          value={totalCapacityGB >= 1024 ? `${(totalCapacityGB / 1024).toFixed(1)} TB` : `${totalCapacityGB} GB`}
          icon={<MemoryStick className="h-5 w-5 text-purple-400" />}
        />
        <SummaryCard
          label={t("memoryInv.mostCommonType")}
          value={mostCommonType}
          icon={<MemoryStick className="h-5 w-5 text-yellow-400" />}
        />
      </div>

      {/* Filter */}
      <div>
        <input
          type="text"
          placeholder={t("memoryInv.filterPlaceholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Server table */}
      <div className="overflow-hidden rounded-xl border border-gray-800/80 bg-gray-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800/80 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3">{t("memoryInv.hostname")}</th>
              <th className="px-4 py-3">{t("memoryInv.ipAddress")}</th>
              <th className="px-4 py-3">{t("memoryInv.totalMemory")}</th>
              <th className="px-4 py-3">{t("memoryInv.slots")}</th>
              <th className="px-4 py-3">{t("memoryInv.memType")}</th>
              <th className="px-4 py-3">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t("common.noData")}
                </td>
              </tr>
            )}
            {filtered.map((server) => {
              const isExpanded = expandedRows.has(server.id);
              const populatedSlots = server.memories.filter((m) => m.populated);
              const totalSlots = server.memories.length;
              const memTypes = Array.from(
                new Set(
                  populatedSlots
                    .map((m) => m.memoryType)
                    .filter((v): v is string => v != null),
                ),
              );

              return (
                <ExpandableRow
                  key={server.id}
                  server={server}
                  isExpanded={isExpanded}
                  onToggle={() => toggleRow(server.id)}
                  populatedSlots={populatedSlots.length}
                  totalSlots={totalSlots}
                  memTypes={memTypes as string[]}
                  t={t}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-100">{value}</div>
    </div>
  );
}

function ExpandableRow({
  server,
  isExpanded,
  onToggle,
  populatedSlots,
  totalSlots,
  memTypes,
  t,
}: {
  server: ServerData;
  isExpanded: boolean;
  onToggle: () => void;
  populatedSlots: number;
  totalSlots: number;
  memTypes: string[];
  t: (key: string) => string;
}) {
  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-gray-800/40"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-gray-400">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-medium text-gray-200">
          {server.hostname}
        </td>
        <td className="px-4 py-3 font-mono text-gray-400">
          {server.ipAddress || "--"}
        </td>
        <td className="px-4 py-3 text-gray-300">
          {server.totalMemoryGB != null ? `${server.totalMemoryGB} GB` : "--"}
        </td>
        <td className="px-4 py-3 text-gray-300">
          <span className="text-green-400">{populatedSlots}</span>
          <span className="text-gray-500"> / {totalSlots}</span>
        </td>
        <td className="px-4 py-3 text-gray-300">
          {memTypes.length > 0 ? memTypes.join(", ") : "--"}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${statusDot(server.status)}`}
            />
            <span className={`text-xs font-medium ${statusColor(server.status)}`}>
              {t(`status.${server.status.toLowerCase()}`)}
            </span>
          </span>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-gray-950/50 px-4 py-0">
            <div className="py-4 pl-8">
              {server.memories.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {t("memoryInv.noSlots")}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800/60 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">{t("memory.slot")}</th>
                      <th className="px-3 py-2">{t("common.status")}</th>
                      <th className="px-3 py-2">{t("memory.capacity")}</th>
                      <th className="px-3 py-2">{t("memory.memoryType")}</th>
                      <th className="px-3 py-2">{t("memory.manufacturers")}</th>
                      <th className="px-3 py-2">{t("memory.speed")}</th>
                      <th className="px-3 py-2">{t("memory.partNumber")}</th>
                      <th className="px-3 py-2">{t("memory.serial")}</th>
                      <th className="px-3 py-2">{t("memory.rank")}</th>
                      <th className="px-3 py-2">{t("memory.formFactor")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/30">
                    {server.memories.map((mem) => (
                      <tr
                        key={mem.id}
                        className={
                          mem.populated
                            ? "text-gray-300"
                            : "text-gray-600"
                        }
                      >
                        <td className="px-3 py-2 font-mono">{mem.slotName}</td>
                        <td className="px-3 py-2">
                          {mem.populated ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                              {t("memory.populated")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-600" />
                              {t("memory.empty")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {mem.populated && mem.capacityGb
                            ? `${mem.capacityGb} GB`
                            : "--"}
                        </td>
                        <td className="px-3 py-2">
                          {mem.populated && mem.memoryType
                            ? mem.memoryType
                            : "--"}
                        </td>
                        <td className="px-3 py-2">
                          {mem.populated && mem.manufacturer
                            ? mem.manufacturer
                            : "--"}
                        </td>
                        <td className="px-3 py-2">
                          {mem.populated && mem.speedMhz
                            ? `${mem.speedMhz} MHz`
                            : "--"}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {mem.populated && mem.partNumber
                            ? mem.partNumber
                            : "--"}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {mem.populated && mem.serialNumber
                            ? mem.serialNumber
                            : "--"}
                        </td>
                        <td className="px-3 py-2">
                          {mem.populated && mem.rank ? mem.rank : "--"}
                        </td>
                        <td className="px-3 py-2">
                          {mem.populated && mem.formFactor
                            ? mem.formFactor
                            : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
