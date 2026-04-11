"use client";

import { useEffect, useState, useCallback } from "react";
import { queries } from "@/lib/prometheus";

interface CoreData {
  cpu: string;
  usage: number;
}

const COLORS = [
  { bg: "bg-green-500", text: "text-green-100", label: "0–30%" },
  { bg: "bg-yellow-500", text: "text-yellow-100", label: "30–60%" },
  { bg: "bg-orange-500", text: "text-orange-100", label: "60–85%" },
  { bg: "bg-red-500", text: "text-red-100", label: "85–100%" },
];

function getColor(usage: number) {
  if (usage < 30) return COLORS[0];
  if (usage < 60) return COLORS[1];
  if (usage < 85) return COLORS[2];
  return COLORS[3];
}

export function CpuCoreHeatmap({ instance }: { instance: string }) {
  const [cores, setCores] = useState<CoreData[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredCore, setHoveredCore] = useState<number | null>(null);

  const fetchCores = useCallback(async () => {
    try {
      const query = queries.cpuPerCore(instance);
      const res = await fetch(
        `/api/metrics/instant?query=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();

      if (json.status !== "success" || !json.data?.result) {
        setError(true);
        return;
      }

      const parsed: CoreData[] = json.data.result
        .map((r: { metric: Record<string, string>; value?: [number, string] }) => ({
          cpu: r.metric.cpu || "0",
          usage: r.value ? parseFloat(r.value[1]) : 0,
        }))
        .sort((a: CoreData, b: CoreData) => parseInt(a.cpu) - parseInt(b.cpu));

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
    const id = setInterval(fetchCores, 5000);
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
        <p className="text-sm text-gray-500">
          Per-core CPU data unavailable
        </p>
      </div>
    );
  }

  const avgUsage =
    cores.reduce((sum, c) => sum + c.usage, 0) / cores.length;

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-gray-700/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          CPU Core Heatmap
          <span className="ml-2 rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {cores.length} cores · avg {avgUsage.toFixed(1)}%
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <div key={c.label} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${c.bg} opacity-80`} />
              <span className="text-[10px] text-gray-500">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(cores.length) * 1.5), 16)}, 1fr)`,
        }}
      >
        {cores.map((core, i) => {
          const color = getColor(core.usage);
          const isHovered = hoveredCore === i;
          return (
            <div
              key={core.cpu}
              className={`relative rounded-sm cursor-default transition-all ${color.bg} ${
                isHovered ? "opacity-100 ring-2 ring-white/40 z-10 scale-110" : "opacity-80"
              }`}
              style={{ aspectRatio: "1", minWidth: 0 }}
              onMouseEnter={() => setHoveredCore(i)}
              onMouseLeave={() => setHoveredCore(null)}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-[9px] font-bold leading-none ${color.text}`}>
                  {core.usage.toFixed(0)}%
                </span>
              </div>
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs whitespace-nowrap z-20 shadow-lg">
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
    </div>
  );
}
