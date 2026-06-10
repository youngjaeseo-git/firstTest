"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { List, Building2, Search, Server, GitCompareArrows, ArrowUpDown } from "lucide-react";
import { useT } from "@/lib/i18n/i18n-context";
import { queries } from "@/lib/prometheus";
import { DataCenterFloorPlan } from "@/components/twin/datacenter-floor-plan";

type PowerState = "running" | "idle" | "off" | "unknown";

function PowerStateBadge({ state }: { state: PowerState }) {
  const styles: Record<PowerState, { bg: string; dot: string; label: string }> = {
    running: { bg: "bg-green-500/15 text-green-400", dot: "bg-green-400", label: "Running" },
    idle: { bg: "bg-yellow-500/15 text-yellow-400", dot: "bg-yellow-400", label: "Idle" },
    off: { bg: "bg-gray-500/15 text-gray-500", dot: "bg-gray-500", label: "OFF" },
    unknown: { bg: "bg-gray-800/50 text-gray-600", dot: "bg-gray-600", label: "..." },
  };
  const s = styles[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", s.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot, state === "running" && "animate-pulse")} />
      {s.label}
    </span>
  );
}

interface ServerPageClientProps {
  rooms: Array<{
    id: string;
    name: string;
    racks: Array<{
      id: string;
      name: string;
      rowLabel: string | null;
      sortOrder: number;
      totalUnits: number;
      positionX: number | null;
      positionY: number | null;
      equipment: Array<{
        id: string;
        hostname: string | null;
        ipAddress: string | null;
        status: string;
        rackPosition: number | null;
        rackHeight: number;
        type: string;
        model?: string | null;
        manufacturer?: string | null;
      }>;
    }>;
  }>;
  servers: Array<{
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    bmcIpAddress: string | null;
    status: string;
    type: string;
    model: string | null;
    manufacturer: string | null;
    cpuManufacturer: string | null;
    cpuModel: string | null;
    roomName: string | null;
    rackName: string | null;
    rackPosition: number | null;
    totalMemoryGB: number | null;
  }>;
  initialView?: "list" | "twin";
}

export function ServerPageClient({ rooms, servers, initialView = "list" }: ServerPageClientProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialRackId = searchParams.get("rack") || null;

  const initialRoomId = initialRackId
    ? rooms.find((r) => r.racks.some((rk) => rk.id === initialRackId))?.id ?? null
    : null;

  const [view, setView] = useState<"list" | "twin">(initialRackId ? "twin" : initialView);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(initialRoomId);
  const [selectedRack, setSelectedRack] = useState<string | null>(initialRackId);
  const [query, setQuery] = useState(initialQuery);
  const [filterModel, setFilterModel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterPower, setFilterPower] = useState("all");
  const [sortKey, setSortKey] = useState<"hostname" | "ipAddress" | "model" | "status">("hostname");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [powerStates, setPowerStates] = useState<Record<string, PowerState>>({});

  const fetchPowerStates = useCallback(async () => {
    try {
      const [upRes, cpuRes] = await Promise.all([
        fetch(`/api/metrics/instant?query=${encodeURIComponent(queries.allNodesUp())}`)
          .then((r) => r.json()),
        fetch(`/api/metrics/instant?query=${encodeURIComponent(queries.fleetCpuPerInstance())}`)
          .then((r) => r.json()),
      ]);

      const upMap = new Map<string, boolean>();
      for (const r of upRes?.data?.result ?? []) {
        const inst = r.metric?.instance || "";
        if (parseFloat(r.value?.[1] || "0") >= 1) upMap.set(inst, true);
      }

      const cpuMap = new Map<string, number>();
      for (const r of cpuRes?.data?.result ?? []) {
        const inst = r.metric?.instance || "";
        cpuMap.set(inst, parseFloat(r.value?.[1] || "0"));
      }

      const states: Record<string, PowerState> = {};
      for (const s of servers) {
        const keys: string[] = [];
        if (s.hostname) keys.push(s.hostname);
        if (s.ipAddress) {
          keys.push(s.ipAddress);
          keys.push(`${s.ipAddress}:9100`);
          keys.push(`${s.ipAddress}:10250`);
        }

        const isUp = keys.some((k) => upMap.has(k));
        if (!isUp) {
          states[s.id] = "off";
          continue;
        }

        let maxCpu = -1;
        for (const k of keys) {
          const cpu = cpuMap.get(k);
          if (cpu !== undefined && cpu > maxCpu) maxCpu = cpu;
        }
        cpuMap.forEach((cpu, inst) => {
          const bare = inst.replace(/:\d+$/, "");
          if (keys.includes(bare) && cpu > maxCpu) maxCpu = cpu;
        });

        if (maxCpu > 5) {
          states[s.id] = "running";
        } else {
          states[s.id] = "idle";
        }
      }
      setPowerStates(states);
    } catch {
      // keep existing states on error
    }
  }, [servers]);

  useEffect(() => {
    fetchPowerStates();
    const timer = setInterval(fetchPowerStates, 30_000);
    return () => clearInterval(timer);
  }, [fetchPowerStates]);

  const modelOptions = useMemo(() => {
    const models = new Set(servers.map((s) => s.model).filter(Boolean) as string[]);
    return Array.from(models).sort();
  }, [servers]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(servers.map((s) => s.status));
    return Array.from(statuses).sort();
  }, [servers]);

  const roomOptions = useMemo(() => {
    const names = new Set(servers.map((s) => s.roomName).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [servers]);

  const filteredServers = useMemo(() => {
    let result = servers;

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((s) =>
        [s.hostname, s.ipAddress, s.bmcIpAddress, s.model, s.manufacturer, s.cpuManufacturer, s.cpuModel, s.roomName, s.rackName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }

    if (filterModel !== "all") {
      result = result.filter((s) => s.model === filterModel);
    }
    if (filterStatus !== "all") {
      result = result.filter((s) => s.status === filterStatus);
    }
    if (filterRoom !== "all") {
      result = result.filter((s) => s.roomName === filterRoom);
    }
    if (filterPower !== "all") {
      result = result.filter((s) => (powerStates[s.id] || "unknown") === filterPower);
    }

    result = [...result].sort((a, b) => {
      const va = (a[sortKey] || "").toLowerCase();
      const vb = (b[sortKey] || "").toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [servers, query, filterModel, filterStatus, filterRoom, filterPower, powerStates, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const activeFilterCount = [filterModel !== "all", filterStatus !== "all", filterRoom !== "all", filterPower !== "all"].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={view === "twin" ? Building2 : Server}
        title={view === "twin" ? t("nav.digitalTwin") : t("servers.title")}
        subtitle={
          <>
            {filteredServers.length}
            {query && ` / ${servers.length}`} {t("servers.count")}
            {Object.keys(powerStates).length > 0 && (
              <span className="ml-3 inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  {Object.values(powerStates).filter((s) => s === "running").length} Running
                </span>
                <span className="inline-flex items-center gap-1 text-yellow-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  {Object.values(powerStates).filter((s) => s === "idle").length} Idle
                </span>
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                  {Object.values(powerStates).filter((s) => s === "off").length} OFF
                </span>
              </span>
            )}
          </>
        }
        accent="green"
        right={
          <div className="flex items-center gap-3">
            <Link href="/servers/compare">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <GitCompareArrows className="h-4 w-4" />
                {t("servers.compare")}
              </Button>
            </Link>
            <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
              <button
                onClick={() => { setView("list"); setSelectedRoom(null); setSelectedRack(null); }}
                className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", view === "list" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200")}
              >
                <List className="h-4 w-4" /> {t("servers.list")}
              </button>
              <button
                onClick={() => { setView("twin"); setSelectedRoom(null); setSelectedRack(null); }}
                className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", view === "twin" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200")}
              >
                <Building2 className="h-4 w-4" /> {t("servers.twin")}
              </button>
            </div>
          </div>
        }
      />

      {view === "list" ? (
        /* LIST VIEW */
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("servers.filterPlaceholder")}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Model: 전체</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Status: 전체</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Room: 전체</option>
              {roomOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={filterPower}
              onChange={(e) => setFilterPower(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Power: 전체</option>
              <option value="running">Running</option>
              <option value="idle">Idle</option>
              <option value="off">OFF</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterModel("all"); setFilterStatus("all"); setFilterRoom("all"); setFilterPower("all"); setQuery(""); }}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-600"
              >
                초기화 ({activeFilterCount})
              </button>
            )}
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                    <SortTh label="Hostname" sortKey="hostname" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label="IP" sortKey="ipAddress" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 font-medium">BMC IP</th>
                    <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 font-medium">Power</th>
                    <th className="px-4 py-3 font-medium">CPU</th>
                    <SortTh label="System Model" sortKey="model" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 font-medium">Room</th>
                    <th className="px-4 py-3 font-medium">Rack / U</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredServers.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer text-gray-300 hover:bg-gray-800/50"
                      onClick={() => {
                        window.location.href = `/servers/${s.id}`;
                      }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/servers/${s.id}`}
                          className="font-medium text-gray-100 hover:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.hostname || "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.ipAddress || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {s.bmcIpAddress || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PowerStateBadge state={powerStates[s.id] || "unknown"} />
                      </td>
                      <td className="px-4 py-3">
                        {s.cpuManufacturer ? (
                          <div className="flex flex-col">
                            <span className="text-gray-200">
                              {s.cpuManufacturer}
                            </span>
                            {s.cpuModel && (
                              <span className="text-xs text-gray-500">
                                {s.cpuModel}
                              </span>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.model ? (
                          <span className="rounded bg-blue-600/10 px-2 py-0.5 font-mono text-xs text-blue-300">
                            {s.model}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">{s.roomName || "-"}</td>
                      <td className="px-4 py-3">
                        {s.rackName || t("servers.unassigned")}{s.rackPosition != null ? ` / U${s.rackPosition}` : ""}
                      </td>
                    </tr>
                  ))}
                  {filteredServers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        {query ? t("servers.noMatch") : t("servers.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : selectedRack ? (
        /* TWIN VIEW - Level 3: Rack Elevation */
        <RackElevation
          rack={rooms.flatMap((r) => r.racks).find((r) => r.id === selectedRack)!}
          roomName={rooms.find((r) => r.id === selectedRoom)?.name || "Room"}
          onBackToRooms={() => { setSelectedRoom(null); setSelectedRack(null); }}
          onBackToRoom={() => setSelectedRack(null)}
          t={t}
        />
      ) : selectedRoom ? (
        /* TWIN VIEW - Level 2: Room Floor Plan */
        <RoomFloorPlan
          room={rooms.find((r) => r.id === selectedRoom)!}
          onSelectRack={setSelectedRack}
          onBackToRooms={() => setSelectedRoom(null)}
          t={t}
        />
      ) : (
        /* TWIN VIEW - Level 1: Data Center Floor Plan + Room Cards */
        <div className="space-y-6">
          <DataCenterFloorPlan
            rooms={rooms}
            onSelectRoom={setSelectedRoom}
            t={t}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room, idx) => {
              const totalEq = room.racks.reduce(
                (s, r) => s + r.equipment.length,
                0,
              );
              const activeEq = room.racks.reduce(
                (s, r) =>
                  s + r.equipment.filter((e) => e.status === "ACTIVE").length,
                0,
              );
              const totalUnits = room.racks.reduce(
                (s, r) => s + r.totalUnits,
                0,
              );
              const usedUnits = room.racks.reduce(
                (s, r) =>
                  s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0),
                0,
              );
              const util =
                totalUnits > 0
                  ? Math.round((usedUnits / totalUnits) * 100)
                  : 0;
              const colors = [
                "from-blue-600/20 via-blue-600/5 to-transparent border-blue-500/40",
                "from-gray-600/10 via-gray-600/5 to-transparent border-gray-600/30",
                "from-purple-600/20 via-purple-600/5 to-transparent border-purple-500/40",
              ];
              const iconColors = [
                "bg-blue-500/20 text-blue-300",
                "bg-gray-600/20 text-gray-400",
                "bg-purple-500/20 text-purple-300",
              ];
              const gradient = colors[idx % colors.length];
              const iconColor = iconColors[idx % iconColors.length];
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 text-left transition-all hover:scale-[1.01] hover:shadow-lg",
                    gradient,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-lg p-1.5", iconColor)}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">
                      {room.name}
                    </h3>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-gray-500">Racks</p>
                      <p className="text-xl font-bold text-blue-400">
                        {room.racks.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Servers</p>
                      <p className="text-xl font-bold text-green-400">
                        {totalEq}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Active</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {activeEq}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>U {t("twin.statUtil")}</span>
                      <span className="font-mono text-[11px]">
                        {usedUnits}/{totalUnits}U ({util}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={cn(
                          "h-full transition-all",
                          util > 85
                            ? "bg-red-500"
                            : util > 60
                              ? "bg-amber-500"
                              : "bg-green-500",
                        )}
                        style={{ width: `${Math.min(util, 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-gray-500 group-hover:text-blue-300">
                    {t("twin.clickToFloorPlan")}
                  </p>
                </button>
              );
            })}
          </div>
          {rooms.length === 0 && (
            <p className="text-gray-500">{t("twin.noRoomData")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* Level 2: Room Floor Plan — 2D spatial visualization */
function RoomFloorPlan({
  room,
  onSelectRack,
  onBackToRooms,
  t,
}: {
  room: ServerPageClientProps["rooms"][0];
  onSelectRack: (id: string) => void;
  onBackToRooms: () => void;
  t: (key: string) => string;
}) {
  const stats = useMemo(() => {
    const totalEquipment = room.racks.reduce((s, r) => s + r.equipment.length, 0);
    const activeEquipment = room.racks.reduce(
      (s, r) => s + r.equipment.filter((e) => e.status === "ACTIVE").length,
      0,
    );
    const failedEquipment = room.racks.reduce(
      (s, r) => s + r.equipment.filter((e) => e.status === "FAILED" || e.status === "REPAIR").length,
      0,
    );
    const totalUnits = room.racks.reduce((s, r) => s + r.totalUnits, 0);
    const usedUnits = room.racks.reduce(
      (s, r) => s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0),
      0,
    );
    return { totalEquipment, activeEquipment, failedEquipment, totalUnits, usedUnits };
  }, [room]);

  const rows = useMemo(() => {
    const rowMap = new Map<string, typeof room.racks>();
    for (const rack of room.racks) {
      const key = rack.rowLabel || "Default";
      if (!rowMap.has(key)) rowMap.set(key, []);
      rowMap.get(key)!.push(rack);
    }
    Array.from(rowMap.values()).forEach((racks) => {
      racks.sort((a, b) => (a.positionX ?? a.sortOrder) - (b.positionX ?? b.sortOrder));
    });
    return Array.from(rowMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [room]);

  const utilPercent = stats.totalUnits > 0 ? Math.round((stats.usedUnits / stats.totalUnits) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[
            { label: t("servers.title"), onClick: onBackToRooms },
            { label: room.name },
          ]}
          className="mb-1"
        />
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{room.name}</h2>
          <span className="rounded-full bg-blue-600/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            {room.racks.length} Racks
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <FloorStatCard label={t("twin.statRacks")} value={room.racks.length} color="text-blue-400" />
        <FloorStatCard label={t("twin.statEquipment")} value={stats.totalEquipment} color="text-cyan-400" />
        <FloorStatCard label={t("twin.statActive")} value={stats.activeEquipment} color="text-green-400" />
        <FloorStatCard
          label={t("twin.statIssues")}
          value={stats.failedEquipment}
          color={stats.failedEquipment > 0 ? "text-red-400" : "text-gray-500"}
        />
        <FloorStatCard
          label={t("twin.statUtil")}
          value={`${utilPercent}%`}
          color={utilPercent > 85 ? "text-red-400" : utilPercent > 60 ? "text-amber-400" : "text-green-400"}
        />
      </div>

      {/* Floor Plan */}
      <Card className="p-0">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/70 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
            <span className="font-mono text-xs tracking-wider text-gray-400">FLOOR PLAN</span>
          </div>
          <span className="text-xs text-gray-600">
            {rows.length} rows · {room.racks.length} racks
          </span>
        </div>

        {/* Floor plan area */}
        <div
          className="relative p-6"
          style={{
            background: `
              radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.03), transparent 70%),
              linear-gradient(rgba(51, 65, 85, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(51, 65, 85, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: "100% 100%, 24px 24px, 24px 24px",
          }}
        >
          {/* Room outline */}
          <div className="rounded-xl border-2 border-dashed border-gray-700/50 p-5">
            <div className="space-y-1">
              {rows.map(([rowLabel, racks], rowIdx) => (
                <div key={rowLabel}>
                  {/* Aisle indicator between rows */}
                  {rowIdx > 0 && (
                    <div className="flex items-center gap-3 py-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-800/30 to-transparent" />
                      <div className="flex items-center gap-2 rounded-full border border-cyan-900/30 bg-cyan-950/20 px-3 py-0.5">
                        <span className="h-1 w-1 rounded-full bg-cyan-600/50" />
                        <span className="text-[10px] font-medium tracking-[0.2em] text-cyan-700">
                          COLD AISLE
                        </span>
                        <span className="h-1 w-1 rounded-full bg-cyan-600/50" />
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-800/30 to-transparent" />
                    </div>
                  )}

                  {/* Row header */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/30 to-blue-600/10 text-xs font-bold text-blue-400 shadow-inner">
                      {rowLabel}
                    </span>
                    <span className="text-xs font-medium text-gray-500">Row {rowLabel}</span>
                    <span className="text-xs text-gray-600">
                      · {racks.length} racks · {racks.reduce((s, r) => s + r.equipment.length, 0)} devices
                    </span>
                  </div>

                  {/* Rack blocks grid */}
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
                  >
                    {racks.map((rack) => (
                      <FloorRackBlock
                        key={rack.id}
                        rack={rack}
                        onClick={() => onSelectRack(rack.id)}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend bar */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-800 bg-gray-900/50 px-4 py-2">
          <span className="text-[10px] font-medium tracking-wider text-gray-600">STATUS</span>
          {[
            ["bg-green-500", t("status.active")],
            ["bg-red-500", t("status.failed")],
            ["bg-purple-500", t("status.maintenance")],
            ["bg-orange-500", t("status.repair")],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-sm", color)} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
          <span className="ml-2 text-[10px] font-medium tracking-wider text-gray-600">U UTIL</span>
          {[
            ["bg-green-500", "<60%"],
            ["bg-amber-500", "60-85%"],
            ["bg-red-500", ">85%"],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", color)} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* Floor Plan: individual rack block */
function FloorRackBlock({
  rack,
  onClick,
  t,
}: {
  rack: ServerPageClientProps["rooms"][0]["racks"][0];
  onClick: () => void;
  t: (key: string) => string;
}) {
  const eqCount = rack.equipment.length;
  const activeCount = rack.equipment.filter((e) => e.status === "ACTIVE").length;
  const failedCount = rack.equipment.filter(
    (e) => e.status === "FAILED" || e.status === "REPAIR",
  ).length;
  const usedU = rack.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0);
  const rackUtil = rack.totalUnits > 0 ? Math.round((usedU / rack.totalUnits) * 100) : 0;

  const borderColor =
    eqCount === 0
      ? "border-gray-700/60"
      : failedCount > 0
        ? "border-red-500/40"
        : rackUtil > 85
          ? "border-red-500/40"
          : rackUtil > 60
            ? "border-amber-500/40"
            : "border-green-500/40";

  const glowShadow =
    eqCount === 0
      ? ""
      : failedCount > 0
        ? "shadow-[0_0_15px_rgba(239,68,68,0.08)]"
        : rackUtil > 85
          ? "shadow-[0_0_15px_rgba(239,68,68,0.08)]"
          : rackUtil > 60
            ? "shadow-[0_0_15px_rgba(245,158,11,0.08)]"
            : "shadow-[0_0_15px_rgba(34,197,94,0.08)]";

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-500",
    FAILED: "bg-red-500",
    MAINTENANCE: "bg-purple-500",
    REPAIR: "bg-orange-500",
    PLANNED: "bg-blue-500",
    DECOMMISSIONED: "bg-gray-600",
  };

  function unitStatus(pos: number): string | null {
    const eq = rack.equipment.find(
      (e) => e.rackPosition != null && pos >= e.rackPosition && pos < e.rackPosition + e.rackHeight,
    );
    return eq?.status ?? null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border-2 bg-gradient-to-b from-gray-800/80 to-gray-900/80 p-3 text-left transition-all duration-200",
        "hover:scale-[1.03] hover:brightness-110",
        borderColor,
        glowShadow,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-gray-500" />
          <span className="font-mono text-sm font-bold text-gray-100">{rack.name}</span>
        </div>
        {failedCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500/90 px-1 text-[9px] font-bold text-white animate-pulse">
            {failedCount}
          </span>
        )}
      </div>

      {/* Mini rack elevation */}
      <div className="mt-2 rounded-lg border border-gray-700/50 bg-gray-950/50 p-1.5">
        <div className="flex h-20 flex-col-reverse gap-[1px]">
          {Array.from({ length: rack.totalUnits }, (_, i) => {
            const status = unitStatus(i + 1);
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-[1px]",
                  status ? STATUS_COLORS[status] || "bg-amber-500" : "bg-gray-800/40",
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              rackUtil > 85
                ? "bg-gradient-to-r from-red-600 to-red-400"
                : rackUtil > 60
                  ? "bg-gradient-to-r from-amber-600 to-amber-400"
                  : "bg-gradient-to-r from-green-600 to-green-400",
            )}
            style={{ width: `${rackUtil}%` }}
          />
        </div>
      </div>

      {/* Stats footer */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-500">
          {usedU}/{rack.totalUnits}U ({rackUtil}%)
        </span>
        <span className="text-[10px] font-medium text-gray-400">
          {activeCount}
          <span className="text-gray-600">/{eqCount}</span>
        </span>
      </div>

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-blue-600/10 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
        <span className="rounded-full bg-gray-900/80 px-3 py-1 text-xs font-medium text-blue-300">
          {t("twin.viewDetail")}
        </span>
      </div>
    </button>
  );
}

/* Floor Plan: stat card */
function FloorStatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold", color)}>{value}</p>
    </div>
  );
}

/* Level 3: Rack Elevation View */
function RackElevation({
  rack,
  roomName,
  onBackToRooms,
  onBackToRoom,
  t,
}: {
  rack: ServerPageClientProps["rooms"][0]["racks"][0];
  roomName: string;
  onBackToRooms: () => void;
  onBackToRoom: () => void;
  t: (key: string) => string;
}) {
  const units = Array.from({ length: rack.totalUnits }, (_, i) => {
    const pos = rack.totalUnits - i;
    const eq = rack.equipment.find(
      (e) => e.rackPosition !== null && pos >= e.rackPosition && pos < e.rackPosition + e.rackHeight,
    );
    const isStart = eq?.rackPosition === pos;
    return { position: pos, equipment: eq || null, isStart };
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-600/30 border-green-600 text-green-300",
    MAINTENANCE: "bg-purple-600/30 border-purple-600 text-purple-300",
    REPAIR: "bg-orange-600/30 border-orange-600 text-orange-300",
    FAILED: "bg-red-600/30 border-red-600 text-red-300",
    PLANNED: "bg-blue-600/30 border-blue-600 text-blue-300",
  };

  const legendItems = [
    ["ACTIVE", t("status.active"), "bg-green-600"],
    ["MAINTENANCE", t("status.maintenance"), "bg-purple-600"],
    ["REPAIR", t("status.repair"), "bg-orange-600"],
    ["FAILED", t("status.failed"), "bg-red-600"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <Breadcrumb
          items={[
            { label: t("servers.title"), onClick: onBackToRooms },
            { label: roomName, onClick: onBackToRoom },
            { label: rack.name },
          ]}
          className="mb-1"
        />
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Rack {rack.name}</h2>
          <span className="text-sm text-gray-400">
            ({rack.equipment.length} devices / {rack.totalUnits}U)
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Rack SVG */}
        <div className="w-96 rounded-lg border-2 border-gray-700 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
              <div className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <span className="font-mono text-[10px] text-gray-500">
              {rack.name}
            </span>
          </div>
          <div className="space-y-px">
            {units.map(({ position, equipment, isStart }) => (
              <div key={position} className="flex items-stretch gap-1">
                <span className="w-8 text-right text-[10px] leading-6 text-gray-500">
                  U{position}
                </span>
                {equipment && isStart ? (
                  <Link
                    href={`/servers/${equipment.id}`}
                    title={`${equipment.hostname || equipment.type} · ${equipment.status}${equipment.model ? ` · ${equipment.model}` : ""}${equipment.manufacturer ? ` · ${equipment.manufacturer}` : ""}`}
                    className={cn(
                      "group/eq relative flex flex-1 items-center rounded border-2 px-2 text-xs transition-all hover:brightness-125 hover:shadow-lg",
                      statusColor[equipment.status] ||
                        "bg-gray-800 border-gray-700 text-gray-400",
                    )}
                    style={{
                      height: `${equipment.rackHeight * 24 + (equipment.rackHeight - 1)}px`,
                    }}
                  >
                    <span className="truncate font-mono">
                      {equipment.hostname || equipment.type}
                    </span>
                    <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-56 rounded-lg border border-gray-700 bg-gray-900 p-3 text-left text-xs shadow-xl group-hover/eq:block">
                      <p className="font-semibold text-gray-100">
                        {equipment.hostname || t("common.unnamed")}
                      </p>
                      <div className="mt-1 space-y-0.5 text-gray-400">
                        <p>
                          <span className="text-gray-500">Status:</span>{" "}
                          <span className="text-gray-200">
                            {equipment.status}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-500">Type:</span>{" "}
                          <span className="text-gray-200">
                            {equipment.type}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-500">Position:</span>{" "}
                          <span className="font-mono text-gray-200">
                            U{equipment.rackPosition} ({equipment.rackHeight}U)
                          </span>
                        </p>
                        {equipment.model && (
                          <p>
                            <span className="text-gray-500">Model:</span>{" "}
                            <span className="font-mono text-blue-300">
                              {equipment.model}
                            </span>
                          </p>
                        )}
                        {equipment.manufacturer && (
                          <p>
                            <span className="text-gray-500">Mfr:</span>{" "}
                            <span className="text-gray-200">
                              {equipment.manufacturer}
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-blue-400">
                        {t("twin.clickToDetail")}
                      </p>
                    </div>
                  </Link>
                ) : equipment ? (
                  <div className="h-0 flex-1" />
                ) : (
                  <div className="flex h-6 flex-1 items-center rounded border border-gray-800 bg-gray-800/30 px-2 text-[10px] text-gray-600">
                    empty
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-300">Legend</p>
          {legendItems.map(([status, label, color]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={cn("h-3 w-3 rounded", color)} />
              <span className="text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Sortable Table Header */
function SortTh({
  label,
  sortKey: key,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: "hostname" | "ipAddress" | "model" | "status";
  current: string;
  dir: "asc" | "desc";
  onSort: (key: "hostname" | "ipAddress" | "model" | "status") => void;
}) {
  const active = current === key;
  return (
    <th
      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-200 transition-colors"
      onClick={() => onSort(key)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "text-blue-400" : "text-gray-600")} />
        {active && (
          <span className="text-[10px] text-blue-400">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}
