"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Cpu } from "lucide-react";

interface FirmwareEquipment {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  manufacturer: string | null;
  model: string | null;
  biosVersion: string | null;
  bmcIpAddress: string | null;
  status: string;
  rack: { name: string; room: { name: string } } | null;
}

interface FirmwareGroup {
  biosVersion: string;
  count: number;
  isLatest: boolean;
  equipment: FirmwareEquipment[];
}

interface ModelGroup {
  model: string;
  manufacturer: string | null;
  total: number;
  firmwareVersions: FirmwareGroup[];
  latestVersion: string | null;
  outdatedCount: number;
}

export default function FirmwarePage() {
  const [equipment, setEquipment] = useState<FirmwareEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [filterOutdated, setFilterOutdated] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/equipment?type=SERVER&limit=500");
      const json = await res.json();
      setEquipment(json.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const modelGroups = buildModelGroups(equipment);
  const totalServers = equipment.length;
  const withBios = equipment.filter((e) => e.biosVersion).length;
  const noBios = totalServers - withBios;
  const uniqueVersions = new Set(equipment.map((e) => e.biosVersion).filter(Boolean)).size;
  const totalOutdated = modelGroups.reduce((s, g) => s + g.outdatedCount, 0);

  const displayGroups = filterOutdated
    ? modelGroups.filter((g) => g.outdatedCount > 0)
    : modelGroups;

  const toggleModel = (key: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleVersion = (key: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Cpu}
        title="Firmware Management"
        subtitle="서버 모델별 BIOS/펌웨어 버전을 비교하고 오래된 버전을 식별합니다."
        accent="amber"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase">Total Servers</p>
          <p className="mt-1 text-2xl font-bold text-gray-100">{totalServers}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase">Unique Firmware Versions</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{uniqueVersions}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase">Outdated</p>
          <p className={`mt-1 text-2xl font-bold ${totalOutdated > 0 ? "text-amber-400" : "text-green-400"}`}>
            {totalOutdated}
          </p>
          <p className="text-xs text-gray-500">same model, older version</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase">No BIOS Info</p>
          <p className={`mt-1 text-2xl font-bold ${noBios > 0 ? "text-gray-400" : "text-green-400"}`}>
            {noBios}
          </p>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={filterOutdated}
            onChange={(e) => setFilterOutdated(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
          />
          Show only models with outdated firmware
        </label>
      </div>

      {/* Model groups */}
      {loading ? (
        <Card><p className="text-gray-500 text-sm">Loading...</p></Card>
      ) : displayGroups.length === 0 ? (
        <Card><p className="text-gray-500 text-sm text-center py-8">
          {filterOutdated ? "All servers are on latest firmware." : "No servers found."}
        </p></Card>
      ) : (
        <div className="space-y-3">
          {displayGroups.map((mg) => {
            const modelKey = mg.model;
            const isExpanded = expandedModels.has(modelKey);
            return (
              <Card key={modelKey} className="p-0 overflow-hidden">
                <button
                  onClick={() => toggleModel(modelKey)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {mg.outdatedCount > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-100">
                        {mg.manufacturer ? `${mg.manufacturer} ` : ""}{mg.model}
                      </span>
                      <span className="ml-3 text-xs text-gray-500">
                        {mg.total} servers, {mg.firmwareVersions.length} version{mg.firmwareVersions.length > 1 ? "s" : ""}
                      </span>
                      {mg.outdatedCount > 0 && (
                        <span className="ml-2 rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-400">
                          {mg.outdatedCount} outdated
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400">
                      Latest: {mg.latestVersion || "N/A"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-800">
                    {mg.firmwareVersions.map((fv) => {
                      const vKey = `${modelKey}::${fv.biosVersion}`;
                      const isVExpanded = expandedVersions.has(vKey);
                      return (
                        <div key={fv.biosVersion} className="border-b border-gray-800/50 last:border-b-0">
                          <button
                            onClick={() => toggleVersion(vKey)}
                            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-800/20"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  fv.isLatest ? "bg-green-500" : "bg-amber-500"
                                }`}
                              />
                              <span className="font-mono text-sm text-gray-200">
                                {fv.biosVersion}
                              </span>
                              {fv.isLatest && (
                                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">
                                  latest
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{fv.count} servers</span>
                          </button>

                          {isVExpanded && (
                            <div className="bg-gray-900/50 px-5 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-800 text-gray-600 uppercase">
                                    <th className="px-3 py-2 text-left">Hostname</th>
                                    <th className="px-3 py-2 text-left">IP</th>
                                    <th className="px-3 py-2 text-left">BMC IP</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Location</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                  {fv.equipment.map((eq) => (
                                    <tr key={eq.id}>
                                      <td className="px-3 py-2">
                                        <Link
                                          href={`/servers/${eq.id}`}
                                          className="font-mono text-blue-400 hover:underline"
                                        >
                                          {eq.hostname || "-"}
                                        </Link>
                                      </td>
                                      <td className="px-3 py-2 font-mono text-gray-400">{eq.ipAddress || "-"}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500">{eq.bmcIpAddress || "-"}</td>
                                      <td className="px-3 py-2"><StatusBadge status={eq.status} /></td>
                                      <td className="px-3 py-2 text-gray-500">
                                        {eq.rack ? `${eq.rack.room.name} / ${eq.rack.name}` : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildModelGroups(equipment: FirmwareEquipment[]): ModelGroup[] {
  const grouped = new Map<string, FirmwareEquipment[]>();

  for (const eq of equipment) {
    const key = eq.model || "(Unknown Model)";
    const list = grouped.get(key) || [];
    list.push(eq);
    grouped.set(key, list);
  }

  const result: ModelGroup[] = [];

  for (const [model, eqs] of Array.from(grouped.entries())) {
    const versionMap = new Map<string, FirmwareEquipment[]>();
    for (const eq of eqs) {
      const v = eq.biosVersion || "(No BIOS info)";
      const list = versionMap.get(v) || [];
      list.push(eq);
      versionMap.set(v, list);
    }

    const versions = Array.from(versionMap.entries())
      .map(([v, list]) => ({ biosVersion: v, count: list.length, equipment: list }))
      .sort((a, b) => b.count - a.count);

    const latestVersion = versions.find((v) => v.biosVersion !== "(No BIOS info)")?.biosVersion || null;

    const firmwareVersions: FirmwareGroup[] = versions.map((v) => ({
      ...v,
      isLatest: v.biosVersion === latestVersion,
    }));

    const outdatedCount = firmwareVersions
      .filter((v) => !v.isLatest && v.biosVersion !== "(No BIOS info)")
      .reduce((s, v) => s + v.count, 0);

    result.push({
      model,
      manufacturer: eqs[0].manufacturer,
      total: eqs.length,
      firmwareVersions,
      latestVersion,
      outdatedCount,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}
