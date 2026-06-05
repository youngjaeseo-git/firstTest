"use client";

import { useEffect, useState, useCallback } from "react";
import { queries } from "@/lib/prometheus";
import { useT } from "@/lib/i18n/i18n-context";

interface CoreData {
  cpu: number;
  usage: number;
}

interface PodCpuData {
  pod: string;
  namespace: string;
  cores: number;
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

function getBarColor(fraction: number) {
  if (fraction < 0.1) return "bg-emerald-500";
  if (fraction < 0.3) return "bg-green-500";
  if (fraction < 0.5) return "bg-yellow-500";
  if (fraction < 0.7) return "bg-orange-500";
  return "bg-red-500";
}

export function CpuCoreHeatmap({ instance, hostIp }: { instance: string; hostIp?: string }) {
  const [cores, setCores] = useState<CoreData[]>([]);
  const [pods, setPods] = useState<PodCpuData[]>([]);
  const [mode, setMode] = useState<"cores" | "pods" | "loading">("loading");
  const [hoveredCore, setHoveredCore] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    // Try per-core first
    try {
      const res = await fetch(
        `/api/metrics/instant?query=${encodeURIComponent(queries.cpuPerCore(instance, hostIp))}`
      ).then((r) => r.json());

      const results = res.data?.result;
      if (Array.isArray(results) && results.length > 1) {
        const parsed: CoreData[] = results
          .map((r: { metric: Record<string, string>; value?: [number, string] }) => ({
            cpu: parseInt(r.metric.cpu || "0", 10),
            usage: parseFloat(r.value?.[1] ?? "") || 0,
          }))
          .filter((c: CoreData) => !isNaN(c.cpu))
          .sort((a: CoreData, b: CoreData) => a.cpu - b.cpu);

        if (parsed.length > 1) {
          setCores(parsed);
          setMode("cores");
          return;
        }
      }
    } catch (err) {
      console.warn("[CpuCoreHeatmap] per-core query failed, falling back to per-pod", err);
    }

    // Fallback: per-pod CPU
    try {
      const res = await fetch(
        `/api/metrics/instant?query=${encodeURIComponent(queries.cpuPerPod(instance))}`
      ).then((r) => r.json());

      const results = res.data?.result;
      if (Array.isArray(results) && results.length > 0) {
        const parsed: PodCpuData[] = results
          .map((r: { metric: Record<string, string>; value?: [number, string] }) => ({
            pod: r.metric.pod || "unknown",
            namespace: r.metric.namespace || "",
            cores: parseFloat(r.value?.[1] ?? "") || 0,
          }))
          .filter((p: PodCpuData) => p.cores > 0.001)
          .sort((a: PodCpuData, b: PodCpuData) => b.cores - a.cores);

        setPods(parsed);
        setMode("pods");
        return;
      }
    } catch (err) {
      console.warn("[CpuCoreHeatmap] per-pod query failed", err);
    }

    setMode("pods");
  }, [instance, hostIp]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
  }, [fetchData]);

  const t = useT();

  if (mode === "loading") {
    return (
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{t("cpu.perPod")}</h3>
        <div className="animate-pulse h-24 bg-gray-800/60 rounded-lg" />
      </div>
    );
  }

  if (mode === "cores" && cores.length > 0) {
    return <CoreHeatmapView cores={cores} hoveredCore={hoveredCore} setHoveredCore={setHoveredCore} />;
  }

  return <PodCpuView pods={pods} />;
}

function CoreHeatmapView({
  cores,
  hoveredCore,
  setHoveredCore,
}: {
  cores: CoreData[];
  hoveredCore: number | null;
  setHoveredCore: (v: number | null) => void;
}) {
  const t = useT();
  const avgUsage = cores.reduce((s, c) => s + c.usage, 0) / cores.length;
  const maxUsage = Math.max(...cores.map((c) => c.usage));
  const colCount = Math.min(cores.length, 32);

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-gray-700/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          {t("cpu.coreHeatmap")}
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

      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
      >
        {cores.map((core, i) => {
          const color = getColor(core.usage);
          const isHovered = hoveredCore === i;
          return (
            <div
              key={core.cpu}
              className={`relative rounded-sm cursor-default transition-all ${color.bg} ${
                isHovered ? "ring-2 ring-white/40 z-10 scale-110" : ""
              }`}
              style={{ aspectRatio: "1", minWidth: 0 }}
              onMouseEnter={() => setHoveredCore(i)}
              onMouseLeave={() => setHoveredCore(null)}
            >
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs whitespace-nowrap z-20 shadow-lg pointer-events-none">
                  <span className="text-gray-400">Core {core.cpu}</span>
                  <span className="ml-2 text-white font-medium">{core.usage.toFixed(1)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodCpuView({ pods }: { pods: PodCpuData[] }) {
  const t = useT();
  const totalCores = pods.reduce((s, p) => s + p.cores, 0);

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-gray-700/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          {t("cpu.perPod")}
          <span className="ml-2 rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {pods.length} {t("cpu.pods")} · {t("cpu.totalCores")} {totalCores.toFixed(1)} cores
          </span>
        </h3>
        <span className="text-[10px] text-gray-500">{t("cpu.perCoreUnavailable")}</span>
      </div>

      {pods.length === 0 ? (
        <p className="text-sm text-gray-500">{t("common.noData")}</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {pods.slice(0, 20).map((pod) => {
            const maxCores = pods[0].cores;
            const fraction = maxCores > 0 ? pod.cores / maxCores : 0;
            return (
              <div key={`${pod.namespace}/${pod.pod}`} className="flex items-center gap-2">
                <div className="w-32 shrink-0 truncate text-[11px] text-gray-400" title={`${pod.namespace}/${pod.pod}`}>
                  {pod.pod}
                </div>
                <div className="flex-1 h-4 rounded bg-gray-800/60 overflow-hidden">
                  <div
                    className={`h-full rounded ${getBarColor(fraction)} transition-all`}
                    style={{ width: `${Math.max(fraction * 100, 1)}%` }}
                  />
                </div>
                <span className="w-24 text-right text-[11px] font-mono text-gray-300">
                  {pod.cores.toFixed(2)} cores
                </span>
              </div>
            );
          })}
          {pods.length > 20 && (
            <p className="text-[10px] text-gray-500 pt-1">
              +{pods.length - 20} more pods
            </p>
          )}
        </div>
      )}
    </div>
  );
}
