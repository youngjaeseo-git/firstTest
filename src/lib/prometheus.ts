/**
 * Prometheus HTTP API client
 *
 * Queries Prometheus for server metrics and auto-discovery.
 * Prometheus URL: http://10.144.38.100:30004
 */

import type { PrometheusQueryResult } from "@/types/metrics";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL || "http://10.144.38.100:30004";

export async function instantQuery(
  query: string,
): Promise<PrometheusQueryResult> {
  const url = new URL("/api/v1/query", PROMETHEUS_URL);
  url.searchParams.set("query", query);

  const res = await fetch(url.toString(), { next: { revalidate: 15 } });
  if (!res.ok) {
    throw new Error(`Prometheus query failed: ${res.statusText}`);
  }
  return res.json();
}

export async function rangeQuery(
  query: string,
  start: Date,
  end: Date,
  step: string = "15s",
): Promise<PrometheusQueryResult> {
  const url = new URL("/api/v1/query_range", PROMETHEUS_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("start", (start.getTime() / 1000).toString());
  url.searchParams.set("end", (end.getTime() / 1000).toString());
  url.searchParams.set("step", step);

  const res = await fetch(url.toString(), { next: { revalidate: 15 } });
  if (!res.ok) {
    throw new Error(`Prometheus range query failed: ${res.statusText}`);
  }
  return res.json();
}

// ============================================
// Auto-Discovery: Fetch Prometheus Targets
// ============================================

interface PrometheusTargetsResponse {
  status: "success" | "error";
  data: {
    activeTargets: {
      labels: Record<string, string>;
      scrapePool: string;
      scrapeUrl: string;
      globalUrl: string;
      lastScrape: string;
      lastScrapeDuration: number;
      health: "up" | "down" | "unknown";
    }[];
    droppedTargets: unknown[];
  };
}

export interface DiscoveredPrometheusTarget {
  instance: string;
  job: string;
  labels: Record<string, string>;
  health: "up" | "down" | "unknown";
  lastScrape: string;
  scrapeUrl: string;
}

/**
 * Fetch all active targets from Prometheus /api/v1/targets.
 * Used for auto-discovery of servers.
 */
export async function fetchTargets(): Promise<DiscoveredPrometheusTarget[]> {
  const url = new URL("/api/v1/targets", PROMETHEUS_URL);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Prometheus targets fetch failed: ${res.statusText}`);
  }

  const data: PrometheusTargetsResponse = await res.json();

  return data.data.activeTargets.map((target) => ({
    instance: target.labels.instance || target.scrapeUrl,
    job: target.labels.job || target.scrapePool,
    labels: target.labels,
    health: target.health,
    lastScrape: target.lastScrape,
    scrapeUrl: target.scrapeUrl,
  }));
}

// ============================================
// Common PromQL Queries
// ============================================

export const queries = {
  cpuUsage: (instance: string) =>
    `100 - (avg by(instance)(rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[5m])) * 100)`,

  cpuPerCore: (instance: string) =>
    `100 - (rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[5m]) * 100)`,

  memoryUsage: (instance: string) =>
    `(1 - node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"}) * 100`,

  memoryTotal: (instance: string) =>
    `node_memory_MemTotal_bytes{instance="${instance}"}`,

  memoryAvailable: (instance: string) =>
    `node_memory_MemAvailable_bytes{instance="${instance}"}`,

  swapUsage: (instance: string) =>
    `(1 - node_memory_SwapFree_bytes{instance="${instance}"} / node_memory_SwapTotal_bytes{instance="${instance}"}) * 100`,

  diskUsage: (instance: string) =>
    `(1 - node_filesystem_avail_bytes{instance="${instance}",fstype!~"tmpfs|devtmpfs"} / node_filesystem_size_bytes{instance="${instance}",fstype!~"tmpfs|devtmpfs"}) * 100`,

  diskIORead: (instance: string) =>
    `rate(node_disk_read_bytes_total{instance="${instance}"}[5m])`,

  diskIOWrite: (instance: string) =>
    `rate(node_disk_written_bytes_total{instance="${instance}"}[5m])`,

  networkRx: (instance: string) =>
    `rate(node_network_receive_bytes_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,

  networkTx: (instance: string) =>
    `rate(node_network_transmit_bytes_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,

  temperature: (instance: string) =>
    `node_hwmon_temp_celsius{instance="${instance}"}`,

  uptime: (instance: string) =>
    `node_time_seconds{instance="${instance}"} - node_boot_time_seconds{instance="${instance}"}`,

  // PDU / power metrics (IPMI)
  powerWatts: (instance: string) =>
    `ipmi_power_watts{instance="${instance}"}`,

  fanSpeed: (instance: string) =>
    `ipmi_fan_speed_rpm{instance="${instance}"}`,

  // Server up/down status
  nodeUp: (instance: string) => `up{instance="${instance}"}`,

  // All servers up status
  allNodesUp: () => `up{job=~"node.*"}`,

  // ---- Phase 1 additions ----

  // Load Average (1m / 5m / 15m)
  loadAvg1: (instance: string) => `node_load1{instance="${instance}"}`,
  loadAvg5: (instance: string) => `node_load5{instance="${instance}"}`,
  loadAvg15: (instance: string) => `node_load15{instance="${instance}"}`,

  // Normalized load = load1 / CPU count (saturation indicator)
  normalizedLoad: (instance: string) =>
    `node_load1{instance="${instance}"} / count without(cpu,mode)(node_cpu_seconds_total{instance="${instance}",mode="idle"})`,

  // CPU mode breakdown (user / system / iowait / steal)
  cpuModeUser: (instance: string) =>
    `avg by(instance)(rate(node_cpu_seconds_total{instance="${instance}",mode="user"}[5m])) * 100`,
  cpuModeSystem: (instance: string) =>
    `avg by(instance)(rate(node_cpu_seconds_total{instance="${instance}",mode="system"}[5m])) * 100`,
  cpuModeIowait: (instance: string) =>
    `avg by(instance)(rate(node_cpu_seconds_total{instance="${instance}",mode="iowait"}[5m])) * 100`,
  cpuModeSteal: (instance: string) =>
    `avg by(instance)(rate(node_cpu_seconds_total{instance="${instance}",mode="steal"}[5m])) * 100`,

  // Memory absolute values
  memoryUsedBytes: (instance: string) =>
    `node_memory_MemTotal_bytes{instance="${instance}"} - node_memory_MemAvailable_bytes{instance="${instance}"}`,
  memoryCached: (instance: string) =>
    `node_memory_Cached_bytes{instance="${instance}"} + node_memory_Buffers_bytes{instance="${instance}"}`,

  // Disk IOPS
  diskReadIOPS: (instance: string) =>
    `rate(node_disk_reads_completed_total{instance="${instance}",device!~"dm-.*|loop.*"}[5m])`,
  diskWriteIOPS: (instance: string) =>
    `rate(node_disk_writes_completed_total{instance="${instance}",device!~"dm-.*|loop.*"}[5m])`,

  // Disk I/O latency (milliseconds)
  diskReadLatency: (instance: string) =>
    `rate(node_disk_read_time_seconds_total{instance="${instance}",device!~"dm-.*|loop.*"}[5m]) / clamp_min(rate(node_disk_reads_completed_total{instance="${instance}",device!~"dm-.*|loop.*"}[5m]), 1) * 1000`,
  diskWriteLatency: (instance: string) =>
    `rate(node_disk_write_time_seconds_total{instance="${instance}",device!~"dm-.*|loop.*"}[5m]) / clamp_min(rate(node_disk_writes_completed_total{instance="${instance}",device!~"dm-.*|loop.*"}[5m]), 1) * 1000`,

  // Disk I/O queue depth
  diskIOQueue: (instance: string) =>
    `node_disk_io_now{instance="${instance}",device!~"dm-.*|loop.*"}`,

  // Network errors and drops
  networkRxErrors: (instance: string) =>
    `rate(node_network_receive_errs_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,
  networkTxErrors: (instance: string) =>
    `rate(node_network_transmit_errs_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,
  networkRxDrops: (instance: string) =>
    `rate(node_network_receive_drop_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,
  networkTxDrops: (instance: string) =>
    `rate(node_network_transmit_drop_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,

  // TCP connections and retransmits
  tcpEstablished: (instance: string) =>
    `node_netstat_Tcp_CurrEstab{instance="${instance}"}`,
  tcpRetransmits: (instance: string) =>
    `rate(node_netstat_Tcp_RetransSegs{instance="${instance}"}[5m])`,

  // IPMI temperature breakdown
  inletTemp: (instance: string) =>
    `ipmi_temperature_celsius{instance="${instance}",name=~"Inlet.*|Ambient.*|Intake.*"}`,
  exhaustTemp: (instance: string) =>
    `ipmi_temperature_celsius{instance="${instance}",name=~"Exhaust.*|Outlet.*"}`,
  cpuSocketTemp: (instance: string) =>
    `ipmi_temperature_celsius{instance="${instance}",name=~"CPU.*Temp|Processor.*Temp"}`,

  // System: processes and file descriptors
  procsRunning: (instance: string) => `node_procs_running{instance="${instance}"}`,
  procsBlocked: (instance: string) => `node_procs_blocked{instance="${instance}"}`,
  fileDescriptorUsage: (instance: string) =>
    `node_filefd_allocated{instance="${instance}"} / node_filefd_maximum{instance="${instance}"} * 100`,

  // ---- Dashboard fleet-wide aggregations ----
  fleetTotalPower: () => `sum(ipmi_power_watts)`,
  fleetAvgMemory: () =>
    `avg((1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100)`,
  fleetTotalNetworkRx: () =>
    `sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m]))`,
  fleetTotalNetworkTx: () =>
    `sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m]))`,
  fleetTopCpu: () =>
    `topk(5, 100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100))`,
};
