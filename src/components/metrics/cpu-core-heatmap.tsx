"use client";

import { useEffect, useState, useCallback } from "react";
import { queries } from "@/lib/prometheus";

interface CoreData {
  cpu: number;
  usage: number;
}

const COLORS = [
  { bg: "bg-emerald-900/80", text: "text-emerald-300", label: "0–10%" },
  { bg: "bg-green-600/80", text: "text-green-100", label: "10–30%" },
  { bg: "bg-yellow-500/80", text: "text-yellow-100", label: "30–60%" },
  { bg: "bg-orange-500/80", text: "text-orange-100", label: "60–85%" },
  { bg: "bg-red-500/80", text: "text-red-100", label: "85%+" },
];

function getColor(usage: number) {
  if (usage < 10) return COLORS[0];
  if (usage < 30) return COLORS[1];
  if (usage < 60) return COLORS[2];
  if (usage < 85) return COLORS[3];
  return COLORS[4];
}

export function CpuCoreHeatmap({ instance }: { instance: string }) {
  const [cores, setCores] = useState<CoreData[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredCore, setHoveredCore] = useState<number | null>(null);

  const fetchCores = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/metrics/instant?query=${encodeURIComponent(queries.cpuPerCore(instance))}`
      ).then((r) => r.json());

      const results = res.data?.result;
      if (!Array.isArray(results) || results.length === 0) {
        setError(true);
        return;
      }

      const parsed: CoreData[] = results
        .map((r: { metric: Record<string, string>; value: [number, string] }) => ({
          cpu: parseInt(r.metric.cpu || "0", 10),
          usage: parseFloat(r.value[1]) || 0,
        }))
        .sort((a: CoreData, b: CoreData) => a.cpu - b.cpu);

      setCores(parsed);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [instance]);

  useEffect(() => {
    fetchCores();
    const id = setInterval(fetchCores, 15000);
    return () => clearInterval(id);
  }, [fetchCores]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          CPU Core Heatmap
        </h3>
        <div className="animate-pulse h-24 bg-gray-800/60 rounded-lg" />
      </div>
    );
  }

  if (error || cores.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          CPU Core Heatmap
        </h3>
        <p className="text-sm text-gray-500">Per-core CPU data unavailable</p>
      </div>
    );
  }

  const avgUsage = cores.reduce((sum, c) => sum + c.usage, 0) / cores.length;
  const maxUsage = Math.max(...cores.map((c) => c.usage));
  const minUsage = Math.min(...cores.map((c) => c.usage));

  const colCount = Math.min(cores.length, 32);
  const halfPoint = Math.ceil(cores.length / 2);

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-gray-700/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          CPU Core Heatmap
          <span className="ml-2 rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {cores.length} cores · avg {avgUsage.toFixed(1)}% · max {maxUsage.toFixed(1)}%
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <div key={c.label} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${c.bg}`} />
              <span className="text-[10px] text-gray-500">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Socket/group hint */}
      {cores.length > 32 && (
        <div className="flex gap-4 mb-2 text-[10px] text-gray-500">
          <span>Core 0–{halfPoint - 1}</span>
          <span>Core {halfPoint}–{cores.length - 1}</span>
        </div>
      )}

      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${colCount}, 1fr)`,
        }}
      >
        {cores.map((core, i) => {
          const color = getColor(core.usage);
          const isHovered = hoveredCore === i;
          const isBoundary = cores.length > 32 && i === halfPoint;
          return (
            <div
              key={core.cpu}
              className={`relative rounded-sm cursor-default transition-all ${color.bg} ${
                isHovered
                  ? "ring-2 ring-white/40 z-10 scale-110"
                  : ""
              } ${isBoundary ? "ml-0.5" : ""}`}
              style={{ aspectRatio: "1", minWidth: 0 }}
              onMouseEnter={() => setHoveredCore(i)}
              onMouseLeave={() => setHoveredCore(null)}
            >
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs whitespace-nowrap z-20 shadow-lg pointer-events-none">
                  <span className="text-gray-400">Core {core.cpu}</span>
                  <span className="ml-2 text-white font-medium">
                    {core.usage.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-500">
        <span>Min: {minUsage.toFixed(1)}%</span>
        <span>Avg: {avgUsage.toFixed(1)}%</span>
        <span>Max: {maxUsage.toFixed(1)}%</span>
        <span className="ml-auto text-gray-600">
          per-core usage via cAdvisor · topology not available
        </span>
      </div>
    </div>
  );
}
