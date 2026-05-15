"use client";

import { useEffect, useState } from "react";
import { queries } from "@/lib/prometheus";
import { useT } from "@/lib/i18n/i18n-context";

interface PodInfo {
  name: string;
  namespace: string;
}

interface NodeMetrics {
  cpuCapacity: number | null;
  memoryCapacity: number | null;
  diskCapacity: number | null;
  cpuUsed: number | null;
  memoryUsed: number | null;
  diskUsedPct: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  runningPods: number | null;
  podList: PodInfo[];
}

async function fetchInstant(query: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/metrics/instant?query=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    const val = data?.data?.result?.[0]?.value?.[1];
    return val ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

async function fetchPodList(query: string): Promise<PodInfo[]> {
  try {
    const res = await fetch(
      `/api/metrics/instant?query=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    const results = data?.data?.result;
    if (!Array.isArray(results)) return [];
    return results
      .map((r: { metric: Record<string, string> }) => ({
        name: r.metric?.pod || "unknown",
        namespace: r.metric?.namespace || "",
      }))
      .sort((a: PodInfo, b: PodInfo) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function formatBytesCompact(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function UsageBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </div>
  );
}

function barColor(pct: number | null) {
  if (pct === null) return "bg-gray-600";
  if (pct > 90) return "bg-red-500";
  if (pct > 70) return "bg-yellow-500";
  return "bg-blue-500";
}

export function NodeOverviewCard({ instance, hostIp }: { instance: string; hostIp?: string }) {
  const t = useT();
  const [metrics, setMetrics] = useState<NodeMetrics>({
    cpuCapacity: null,
    memoryCapacity: null,
    diskCapacity: null,
    cpuUsed: null,
    memoryUsed: null,
    diskUsedPct: null,
    diskUsedBytes: null,
    diskTotalBytes: null,
    runningPods: null,
    podList: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [
        cpuCap, memCap, diskCap,
        cpuUsed, memUsed,
        diskPct, diskUsed, diskTotal,
        pods, podList,
      ] = await Promise.all([
        fetchInstant(queries.nodeCapacityCpu(instance)),
        fetchInstant(queries.nodeCapacityMemory(instance)),
        fetchInstant(queries.nodeCapacityDisk(instance)),
        fetchInstant(queries.loadAvg5(instance, hostIp)),
        fetchInstant(queries.memoryUsedBytes(instance, hostIp)),
        fetchInstant(queries.hostDiskUsage(instance, hostIp)),
        fetchInstant(queries.hostDiskUsedBytes(instance, hostIp)),
        fetchInstant(queries.hostDiskTotalBytes(instance, hostIp)),
        fetchInstant(queries.kubeletRunningPods(instance)),
        fetchPodList(queries.nodePodList(instance)),
      ]);

      if (cancelled) return;

      const effectiveDiskCap =
        diskCap && diskCap > 0 ? diskCap : diskTotal;

      setMetrics({
        cpuCapacity: cpuCap,
        memoryCapacity: memCap,
        diskCapacity: effectiveDiskCap,
        cpuUsed: cpuUsed,
        memoryUsed: memUsed,
        diskUsedPct: diskPct,
        diskUsedBytes: diskUsed,
        diskTotalBytes: diskTotal,
        runningPods: pods ?? podList.length,
        podList: podList,
      });
      setLoading(false);
    }

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [instance]);

  const hasData =
    metrics.cpuCapacity !== null ||
    metrics.memoryCapacity !== null ||
    metrics.runningPods !== null ||
    metrics.podList.length > 0;

  if (!loading && !hasData) return null;

  const cpuPct =
    metrics.cpuUsed !== null && metrics.cpuCapacity !== null && metrics.cpuCapacity > 0
      ? (metrics.cpuUsed / metrics.cpuCapacity) * 100
      : null;
  const memPct =
    metrics.memoryUsed !== null && metrics.memoryCapacity !== null && metrics.memoryCapacity > 0
      ? (metrics.memoryUsed / metrics.memoryCapacity) * 100
      : null;

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-emerald-500/60" />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {t("node.resources")}
        </h3>
        <span className="ml-auto rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] text-gray-500">
          kube-state-metrics
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-800/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* CPU */}
            <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">CPU</p>
              <p className="mt-1 text-lg font-semibold text-gray-200">
                {metrics.cpuUsed !== null ? metrics.cpuUsed.toFixed(1) : "-"}
                {metrics.cpuCapacity !== null && (
                  <span className="text-sm text-gray-500 font-normal">
                    {" "}/ {metrics.cpuCapacity} {t("node.cores")}
                  </span>
                )}
              </p>
              {cpuPct !== null && (
                <>
                  <UsageBar pct={cpuPct} color={barColor(cpuPct)} />
                  <p className="mt-1 text-[10px] text-gray-500">{cpuPct.toFixed(1)}% {t("node.used")}</p>
                </>
              )}
            </div>

            {/* Memory */}
            <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Memory</p>
              <p className="mt-1 text-lg font-semibold text-gray-200">
                {metrics.memoryUsed !== null ? formatBytesCompact(metrics.memoryUsed) : "-"}
                {metrics.memoryCapacity !== null && (
                  <span className="text-sm text-gray-500 font-normal">
                    {" "}/ {formatBytesCompact(metrics.memoryCapacity)}
                  </span>
                )}
              </p>
              {memPct !== null && (
                <>
                  <UsageBar pct={memPct} color={barColor(memPct)} />
                  <p className="mt-1 text-[10px] text-gray-500">{memPct.toFixed(1)}% {t("node.used")}</p>
                </>
              )}
            </div>

            {/* Disk */}
            <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Disk</p>
              <p className="mt-1 text-lg font-semibold text-gray-200">
                {metrics.diskUsedBytes !== null
                  ? formatBytesCompact(metrics.diskUsedBytes)
                  : metrics.diskUsedPct !== null
                    ? `${metrics.diskUsedPct.toFixed(1)}%`
                    : "-"}
                {metrics.diskTotalBytes !== null && metrics.diskTotalBytes > 0 && (
                  <span className="text-sm text-gray-500 font-normal">
                    {" "}/ {formatBytesCompact(metrics.diskTotalBytes)}
                  </span>
                )}
              </p>
              {metrics.diskUsedPct !== null && (
                <>
                  <UsageBar pct={metrics.diskUsedPct} color={barColor(metrics.diskUsedPct)} />
                  <p className="mt-1 text-[10px] text-gray-500">{metrics.diskUsedPct.toFixed(1)}% {t("node.used")}</p>
                </>
              )}
            </div>

            {/* Pods */}
            <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Pods</p>
              <p className="mt-1 text-lg font-semibold text-gray-200">
                {metrics.runningPods !== null ? metrics.runningPods : "-"}
                <span className="text-sm text-gray-500 font-normal"> {t("node.running")}</span>
              </p>
            </div>
          </div>

          {/* Pod List */}
          {metrics.podList.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-800/60 bg-gray-800/20 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                {t("node.runningPods")} ({metrics.podList.length})
              </p>
              <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-3">
                {metrics.podList.map((pod) => (
                  <div
                    key={`${pod.namespace}/${pod.name}`}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                    <span className="text-gray-500 shrink-0">{pod.namespace}/</span>
                    <span className="text-gray-300 truncate">{pod.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
