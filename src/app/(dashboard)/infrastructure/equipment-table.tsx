"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPlatform } from "@/lib/platform-mapper";
import { useT } from "@/lib/i18n/i18n-context";

interface EquipmentRow {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  type: string;
  model: string | null;
  status: string;
  rackHeight: number;
  totalMemoryGB: number | null;
  location: string | null;
  cpuModel: string | null;
}

export function EquipmentTable({ data }: { data: EquipmentRow[] }) {
  const t = useT();
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const platforms = useMemo(() => {
    const map = new Map<string, number>();
    for (const eq of data) {
      const p = getPlatform(eq.model);
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtered = useMemo(() => {
    let result = data;
    if (platformFilter) {
      result = result.filter(eq => getPlatform(eq.model) === platformFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(eq =>
        (eq.hostname?.toLowerCase().includes(q)) ||
        (eq.ipAddress?.toLowerCase().includes(q)) ||
        (eq.model?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [data, platformFilter, search]);

  return (
    <>
      {/* Platform filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Platform:</span>
        <button
          onClick={() => setPlatformFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !platformFilter
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
              : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
          }`}
        >
          All ({data.length})
        </button>
        {platforms.map(([platform, count]) => (
          <button
            key={platform}
            onClick={() => setPlatformFilter(platformFilter === platform ? null : platform)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              platformFilter === platform
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
            }`}
          >
            {platform} ({count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search hostname, IP, model..."
          className="w-full sm:w-80 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Equipment table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/80 bg-gray-900/50 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Hostname</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Platform</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">U</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CPU</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Memory</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map((eq) => (
                <tr
                  key={eq.id}
                  className="text-gray-300 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-100">
                    <Link
                      href={`/infrastructure/${eq.id}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {eq.hostname || "-"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {eq.ipAddress || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="rounded-md bg-gray-800 px-2 py-0.5 text-gray-300">
                      {getPlatform(eq.model)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{eq.model || "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{eq.rackHeight}U</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={eq.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {eq.location || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {eq.cpuModel || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {eq.totalMemoryGB ? `${eq.totalMemoryGB} GB` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/infrastructure/${eq.id}`}>
                        <Button variant="ghost" size="sm">
                          Detail
                        </Button>
                      </Link>
                      <Link href={`/infrastructure/${eq.id}/memory`}>
                        <Button variant="ghost" size="sm">
                          Memory
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-gray-500">
                    <p className="font-medium">{t("infra.noEquipment")}</p>
                    {(platformFilter || search) && (
                      <p className="text-xs mt-1">{t("infra.tryClearFilters")}</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-800/60 px-4 py-2 text-xs text-gray-500">
          Showing {filtered.length} of {data.length} equipment
        </div>
      </Card>
    </>
  );
}
