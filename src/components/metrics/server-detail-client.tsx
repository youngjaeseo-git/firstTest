"use client";

import { useState, useEffect } from "react";
import { MetricChart } from "./metric-chart";
import { CpuCoreHeatmap } from "./cpu-core-heatmap";
import { NodeOverviewCard } from "./node-overview-card";
import { queries } from "@/lib/prometheus";
import { useT } from "@/lib/i18n/i18n-context";

const DURATIONS = [
  { label: "15m", value: 15, step: "15s" },
  { label: "1h", value: 60, step: "30s" },
  { label: "6h", value: 360, step: "2m" },
  { label: "24h", value: 1440, step: "5m" },
  { label: "7d", value: 10080, step: "30m" },
];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatBytesPerSec = (bytes: number) => `${formatBytes(bytes)}/s`;
const formatPercent = (v: number) => `${v.toFixed(1)}%`;
const formatCelsius = (v: number) => `${v.toFixed(1)}°C`;
const formatWatts = (v: number) => `${v.toFixed(0)} W`;
const formatMs = (v: number) => {
  if (Math.abs(v) >= 1) return `${v.toFixed(1)} ms`;
  if (Math.abs(v) >= 0.001) return `${(v * 1000).toFixed(1)} µs`;
  return `${(v * 1000000).toFixed(1)} ns`;
};
const formatIOPS = (v: number) => `${v.toFixed(0)} IOPS`;

interface Props {
  instance: string;
  hostIp?: string;
}

export function ServerDetailClient({ instance, hostIp }: Props) {
  const [duration, setDuration] = useState(DURATIONS[1]);
  const t = useT();

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("server.range")}</span>
        <div className="flex rounded-lg border border-gray-800/80 bg-gray-800/40 p-0.5">
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              onClick={() => setDuration(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                duration.label === d.label
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span className="ml-auto rounded-md bg-gray-800/60 px-2 py-1 text-[11px] text-gray-500">
          <span className="font-mono">{instance}</span>
        </span>
      </div>

      {/* System Health Quick View */}
      <SystemHealthCard instance={instance} hostIp={hostIp} />

      {/* Node Resources (kube-state-metrics) */}
      <NodeOverviewCard instance={instance} hostIp={hostIp} />

      {/* ── Section 1: CPU ── */}
      <SectionHeader title={t("server.cpu")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.cpuUsage")}
          unit="%"
          series={[
            {
              label: "CPU",
              query: queries.cpuUsage(instance, hostIp),
              color: "#3b82f6",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
        <MetricChart
          title={t("server.cpuLoad")}
          unit="cores"
          series={[
            { label: "1m avg", query: queries.loadAvg1(instance, hostIp), color: "#f59e0b" },
            { label: "5m avg", query: queries.loadAvg5(instance, hostIp), color: "#ef4444" },
            { label: "15m avg", query: queries.loadAvg15(instance, hostIp), color: "#8b5cf6" },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => v.toFixed(2)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.cpuModeBreakdown")}
          unit="%"
          series={[
            { label: "user", query: queries.cpuModeUser(instance, hostIp), color: "#3b82f6" },
            { label: "system", query: queries.cpuModeSystem(instance, hostIp), color: "#ef4444" },
            { label: "iowait", query: queries.cpuModeIowait(instance, hostIp), color: "#f59e0b" },
            { label: "steal", query: queries.cpuModeSteal(instance, hostIp), color: "#8b5cf6" },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
        <MetricChart
          title={t("server.cfsThrottled")}
          unit="sec/s"
          series={[
            { label: "Throttled", query: queries.cpuModeIowait(instance, hostIp), color: "#f59e0b" },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(3)}s`}
        />
      </div>

      {/* CPU Core Heatmap - full width */}
      <CpuCoreHeatmap instance={instance} hostIp={hostIp} />

      {/* ── Section 2: Memory ── */}
      <SectionHeader title={t("server.memory")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.memoryUsage")}
          unit="%"
          series={[
            {
              label: "Memory",
              query: queries.memoryUsage(instance, hostIp),
              color: "#10b981",
            },
            {
              label: "Swap",
              query: queries.swapUsage(instance, hostIp),
              color: "#f59e0b",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
        <MetricChart
          title={t("server.memoryAbsolute")}
          unit="bytes"
          series={[
            {
              label: "Used",
              query: queries.memoryUsedBytes(instance, hostIp),
              color: "#10b981",
            },
            {
              label: "Cache+Buffer",
              query: queries.memoryCached(instance, hostIp),
              color: "#6366f1",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatBytes}
        />
      </div>

      {/* ── Section 3: Disk ── */}
      <SectionHeader title={t("server.disk")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.diskIoThroughput")}
          unit="Bytes/s"
          series={[
            {
              label: "Read",
              query: queries.diskIORead(instance, hostIp),
              color: "#8b5cf6",
            },
            {
              label: "Write",
              query: queries.diskIOWrite(instance, hostIp),
              color: "#ec4899",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatBytesPerSec}
        />
        <MetricChart
          title={t("server.diskIops")}
          unit="ops/s"
          series={[
            {
              label: "Read IOPS",
              query: queries.diskReadIOPS(instance, hostIp),
              color: "#8b5cf6",
            },
            {
              label: "Write IOPS",
              query: queries.diskWriteIOPS(instance, hostIp),
              color: "#ec4899",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatIOPS}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.diskIoLatency")}
          unit="ms"
          series={[
            {
              label: "Read",
              query: queries.diskReadLatency(instance, hostIp),
              color: "#8b5cf6",
            },
            {
              label: "Write",
              query: queries.diskWriteLatency(instance, hostIp),
              color: "#ec4899",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatMs}
        />
        <MetricChart
          title={t("server.diskUsage")}
          unit="%"
          series={[
            {
              label: "Usage",
              query: queries.hostDiskUsage(instance, hostIp),
              color: "#f97316",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
      </div>

      {/* Filesystem Breakdown */}
      <FilesystemBreakdown instance={instance} hostIp={hostIp} />

      {/* ── Section 4: Network ── */}
      <SectionHeader title={t("server.network")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.networkBandwidth")}
          unit="Bytes/s"
          series={[
            {
              label: "RX",
              query: queries.networkRx(instance, hostIp),
              color: "#06b6d4",
            },
            {
              label: "TX",
              query: queries.networkTx(instance, hostIp),
              color: "#84cc16",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatBytesPerSec}
        />
        <MetricChart
          title={t("server.networkErrors")}
          unit="pkt/s"
          series={[
            {
              label: "RX Errors",
              query: queries.networkRxErrors(instance, hostIp),
              color: "#ef4444",
            },
            {
              label: "TX Errors",
              query: queries.networkTxErrors(instance, hostIp),
              color: "#f97316",
            },
            {
              label: "RX Drops",
              query: queries.networkRxDrops(instance, hostIp),
              color: "#dc2626",
            },
            {
              label: "TX Drops",
              query: queries.networkTxDrops(instance, hostIp),
              color: "#ea580c",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(2)} pkt/s`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.tcpConnections")}
          unit=""
          series={[
            {
              label: "Established",
              query: queries.tcpEstablished(instance, hostIp),
              color: "#06b6d4",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(0)}`}
        />
        <MetricChart
          title={t("server.tcpRetransmits")}
          unit="segs/s"
          series={[
            {
              label: "Retransmit",
              query: queries.tcpRetransmits(instance, hostIp),
              color: "#f59e0b",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(2)}/s`}
        />
      </div>

      {/* Network Interface Inventory */}
      <NetworkInterfaceInventory instance={instance} hostIp={hostIp} />

      {/* ── Section 5: Hardware / Thermal ── */}
      <SectionHeader title={t("server.hardware")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.temperature")}
          unit="°C"
          series={[
            {
              label: "Temp",
              query: queries.temperature(instance, hostIp),
              color: "#ef4444",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatCelsius}
        />
        <MetricChart
          title={t("server.ipmiTemperature")}
          unit="°C"
          series={[
            {
              label: "Inlet",
              query: queries.inletTemp(instance),
              color: "#06b6d4",
            },
            {
              label: "Exhaust",
              query: queries.exhaustTemp(instance),
              color: "#f97316",
            },
            {
              label: "CPU Socket",
              query: queries.cpuSocketTemp(instance),
              color: "#ef4444",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatCelsius}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title={t("server.powerConsumption")}
          unit="Watts"
          series={[
            {
              label: "Package",
              query: queries.powerWatts(instance),
              color: "#fbbf24",
            },
            {
              label: "DRAM",
              query: queries.powerDramWatts(instance),
              color: "#f97316",
            },
            {
              label: "PP0 (Cores)",
              query: queries.powerPP0Watts(instance),
              color: "#ef4444",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatWatts}
        />
        <MetricChart
          title={t("server.fanSpeed")}
          unit="RPM"
          series={[
            {
              label: "Fan",
              query: queries.fanSpeed(instance, hostIp),
              color: "#a78bfa",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(0)} RPM`}
        />
      </div>
    </div>
  );
}

// ============================================
// Enhancement 1: System Health Quick View
// ============================================

interface HealthData {
  uptime: number | null;
  bootTime: number | null;
  nodeExporterUp: boolean | null;
  cadvisorUp: boolean | null;
  memAvailable: number | null;
  memTotal: number | null;
}

async function fetchInstantValue(query: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/metrics/instant?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    const val = data?.data?.result?.[0]?.value?.[1];
    return val ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

function SystemHealthCard({ instance, hostIp }: Props) {
  const t = useT();
  const [data, setData] = useState<HealthData>({
    uptime: null, bootTime: null,
    nodeExporterUp: null, cadvisorUp: null,
    memAvailable: null, memTotal: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [uptime, bootTime, neUp, caUp, memAvail, memTotal] = await Promise.all([
        fetchInstantValue(queries.uptime(instance, hostIp)),
        fetchInstantValue(queries.bootTime(instance, hostIp)),
        fetchInstantValue(queries.nodeExporterUp(instance, hostIp)),
        fetchInstantValue(queries.cadvisorUp(instance)),
        fetchInstantValue(queries.memoryAvailable(instance, hostIp)),
        fetchInstantValue(queries.memoryTotal(instance, hostIp)),
      ]);
      if (cancelled) return;
      setData({
        uptime,
        bootTime,
        nodeExporterUp: neUp !== null ? neUp === 1 : null,
        cadvisorUp: caUp !== null ? caUp === 1 : null,
        memAvailable: memAvail,
        memTotal: memTotal,
      });
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [instance, hostIp]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm">
        <div className="h-16 animate-pulse bg-gray-800/40 rounded-lg" />
      </div>
    );
  }

  const hasAnyData = data.uptime !== null || data.nodeExporterUp !== null || data.memAvailable !== null;
  if (!hasAnyData) return null;

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}${t("system.days")} ${hours}${t("system.hours")}`;
    if (hours > 0) return `${hours}${t("system.hours")} ${mins}${t("system.mins")}`;
    return `${mins}${t("system.mins")}`;
  };

  const formatBootDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleString();
  };

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-cyan-500/60" />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {t("system.health")}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Uptime */}
        {data.uptime !== null && (
          <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{t("system.uptime")}</p>
            <p className="mt-1 text-lg font-semibold text-gray-200">{formatUptime(data.uptime)}</p>
            {data.bootTime !== null && (
              <p className="text-[10px] text-gray-500">{t("system.bootedAt")} {formatBootDate(data.bootTime)}</p>
            )}
          </div>
        )}

        {/* Memory Available */}
        {data.memAvailable !== null && data.memTotal !== null && (
          <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{t("system.memAvailable")}</p>
            <p className="mt-1 text-lg font-semibold text-gray-200">
              {formatBytes(data.memAvailable)}
            </p>
            <p className="text-[10px] text-gray-500">
              / {formatBytes(data.memTotal)}
            </p>
          </div>
        )}

        {/* Prometheus Targets */}
        <div className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{t("system.dataSources")}</p>
          <div className="mt-2 space-y-1.5">
            <TargetStatus label="node-exporter" status={data.nodeExporterUp} />
            <TargetStatus label="cAdvisor" status={data.cadvisorUp} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TargetStatus({ label, status }: { label: string; status: boolean | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full shrink-0 ${
        status === null ? "bg-gray-600" : status ? "bg-emerald-500" : "bg-red-500"
      }`} />
      <span className="text-gray-400">{label}</span>
      <span className={`ml-auto text-[10px] font-medium ${
        status === null ? "text-gray-600" : status ? "text-emerald-400" : "text-red-400"
      }`}>
        {status === null ? "-" : status ? "UP" : "DOWN"}
      </span>
    </div>
  );
}

// ============================================
// Enhancement 2: Filesystem Breakdown
// ============================================

interface FsInfo {
  mountpoint: string;
  fstype: string;
  device: string;
  sizeBytes: number;
  availBytes: number;
}

function FilesystemBreakdown({ instance, hostIp }: Props) {
  const t = useT();
  const [filesystems, setFilesystems] = useState<FsInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sizeRes, availRes] = await Promise.all([
          fetch(`/api/metrics/instant?query=${encodeURIComponent(queries.filesystemSize(instance, hostIp))}`).then(r => r.json()),
          fetch(`/api/metrics/instant?query=${encodeURIComponent(queries.filesystemAvail(instance, hostIp))}`).then(r => r.json()),
        ]);

        const sizeResults = sizeRes?.data?.result || [];
        const availResults = availRes?.data?.result || [];

        if (cancelled || sizeResults.length === 0) {
          setLoading(false);
          return;
        }

        const availMap = new Map<string, number>();
        for (const r of availResults) {
          availMap.set(r.metric.mountpoint, parseFloat(r.value[1]) || 0);
        }

        const fsList: FsInfo[] = sizeResults
          .map((r: { metric: Record<string, string>; value: [number, string] }) => ({
            mountpoint: r.metric.mountpoint || "?",
            fstype: r.metric.fstype || "?",
            device: r.metric.device || "?",
            sizeBytes: parseFloat(r.value[1]) || 0,
            availBytes: availMap.get(r.metric.mountpoint) || 0,
          }))
          .filter((fs: FsInfo) => fs.sizeBytes > 0)
          .sort((a: FsInfo, b: FsInfo) => b.sizeBytes - a.sizeBytes);

        setFilesystems(fsList);
      } catch { /* no data */ }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [instance, hostIp]);

  if (loading || filesystems.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-1 rounded-full bg-purple-500/60" />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {t("system.filesystems")}
        </h3>
        <span className="ml-auto rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] text-gray-500">
          node-exporter
        </span>
      </div>
      <div className="space-y-2">
        {filesystems.map((fs) => {
          const usedBytes = fs.sizeBytes - fs.availBytes;
          const usedPct = fs.sizeBytes > 0 ? (usedBytes / fs.sizeBytes) * 100 : 0;
          return (
            <div key={fs.mountpoint} className="rounded-lg border border-gray-800/60 bg-gray-800/20 p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-200">{fs.mountpoint}</span>
                  <span className="text-gray-500">{fs.device}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <span>{fs.fstype}</span>
                  <span>{formatBytes(usedBytes)} / {formatBytes(fs.sizeBytes)}</span>
                  <span className={usedPct > 90 ? "text-red-400 font-medium" : usedPct > 70 ? "text-yellow-400" : "text-gray-400"}>
                    {usedPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-yellow-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Enhancement 3: Network Interface Inventory
// ============================================

interface NicInfo {
  device: string;
  operstate: string;
  speed: number | null;
}

function NetworkInterfaceInventory({ instance, hostIp }: Props) {
  const t = useT();
  const [interfaces, setInterfaces] = useState<NicInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [upRes, speedRes] = await Promise.all([
          fetch(`/api/metrics/instant?query=${encodeURIComponent(queries.networkInterfaceUp(instance, hostIp))}`).then(r => r.json()),
          fetch(`/api/metrics/instant?query=${encodeURIComponent(queries.networkInterfaceSpeed(instance, hostIp))}`).then(r => r.json()),
        ]);

        const upResults = upRes?.data?.result || [];
        if (cancelled || upResults.length === 0) {
          setLoading(false);
          return;
        }

        const speedMap = new Map<string, number>();
        for (const r of (speedRes?.data?.result || [])) {
          speedMap.set(r.metric.device, parseFloat(r.value[1]) || 0);
        }

        const nics: NicInfo[] = upResults
          .map((r: { metric: Record<string, string>; value: [number, string] }) => ({
            device: r.metric.device || "?",
            operstate: parseFloat(r.value[1]) === 1 ? "up" : "down",
            speed: speedMap.get(r.metric.device) ?? null,
          }))
          .sort((a: NicInfo, b: NicInfo) => {
            if (a.operstate !== b.operstate) return a.operstate === "up" ? -1 : 1;
            return a.device.localeCompare(b.device);
          });

        setInterfaces(nics);
      } catch { /* no data */ }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [instance, hostIp]);

  if (loading || interfaces.length === 0) return null;

  const formatSpeed = (bytesPerSec: number) => {
    const bitsPerSec = bytesPerSec * 8;
    if (bitsPerSec >= 1e9) return `${(bitsPerSec / 1e9).toFixed(0)} Gbps`;
    if (bitsPerSec >= 1e6) return `${(bitsPerSec / 1e6).toFixed(0)} Mbps`;
    return `${(bitsPerSec / 1e3).toFixed(0)} Kbps`;
  };

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-1 rounded-full bg-cyan-500/60" />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {t("system.networkInterfaces")}
        </h3>
        <span className="ml-auto rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] text-gray-500">
          {interfaces.length} {t("system.interfaces")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {interfaces.map((nic) => (
          <div key={nic.device} className="flex items-center gap-2 rounded-lg border border-gray-800/60 bg-gray-800/20 px-3 py-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${nic.operstate === "up" ? "bg-emerald-500" : "bg-gray-600"}`} />
            <span className="font-mono text-xs text-gray-200">{nic.device}</span>
            {nic.speed !== null && nic.speed > 0 && (
              <span className="ml-auto text-[10px] text-gray-500">{formatSpeed(nic.speed)}</span>
            )}
            <span className={`text-[10px] font-medium ${nic.operstate === "up" ? "text-emerald-400" : "text-gray-600"}`}>
              {nic.operstate.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Section Header
// ============================================

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-blue-500/60" />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-800 to-transparent" />
    </div>
  );
}
