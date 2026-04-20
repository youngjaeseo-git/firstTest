/**
 * Prometheus HTTP API client
 *
 * Queries Prometheus for server metrics and auto-discovery.
 * Prometheus URL: http://10.100.175.248:8080 (K8s ClusterIP)
 */

import type { PrometheusQueryResult } from "@/types/metrics";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL || "http://10.100.175.248:8080";

const FETCH_TIMEOUT_MS = 3000;

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export async function instantQuery(
  query: string,
): Promise<PrometheusQueryResult> {
  const url = new URL("/api/v1/query", PROMETHEUS_URL);
  url.searchParams.set("query", query);

  const res = await fetchWithTimeout(url.toString(), { next: { revalidate: 15 } } as RequestInit);
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

  const res = await fetchWithTimeout(url.toString(), { next: { revalidate: 15 } } as RequestInit);
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

  const res = await fetchWithTimeout(url.toString(), { cache: "no-store" });
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
    `sum(rate(container_cpu_usage_seconds_total{instance="${instance}",id="/"}[5m])) / scalar(machine_cpu_cores{instance="${instance}"}) * 100`,

  cpuPerCore: (instance: string) =>
    `rate(container_cpu_usage_seconds_total{instance="${instance}",id="/"}[5m]) * 100`,

  memoryUsage: (instance: string) =>
    `container_memory_working_set_bytes{instance="${instance}",id="/"} / machine_memory_bytes{instance="${instance}"} * 100`,

  memoryTotal: (instance: string) =>
    `machine_memory_bytes{instance="${instance}"}`,

  memoryAvailable: (instance: string) =>
    `machine_memory_bytes{instance="${instance}"} - container_memory_working_set_bytes{instance="${instance}",id="/"}`,

  swapUsage: (instance: string) =>
    `container_memory_swap{instance="${instance}",id="/"}`,

  diskUsage: (instance: string) =>
    `container_fs_usage_bytes{instance="${instance}",id="/"} / container_fs_limit_bytes{instance="${instance}",id="/"} * 100`,

  diskIORead: (instance: string) =>
    `rate(container_fs_reads_bytes_total{instance="${instance}",id="/"}[5m])`,

  diskIOWrite: (instance: string) =>
    `rate(container_fs_writes_bytes_total{instance="${instance}",id="/"}[5m])`,

  networkRx: (instance: string) =>
    `rate(container_network_receive_bytes_total{instance="${instance}",interface!~"lo|veth.*|cni.*|docker.*|br-.*"}[5m])`,

  networkTx: (instance: string) =>
    `rate(container_network_transmit_bytes_total{instance="${instance}",interface!~"lo|veth.*|cni.*|docker.*|br-.*"}[5m])`,

  temperature: (instance: string) =>
    `{job="temperature",instance="${instance}"}`,

  uptime: (instance: string) =>
    `time() - container_start_time_seconds{instance="${instance}",id="/"}`,

  powerWatts: (instance: string) =>
    `rate(Package_Joules_Consumed{instance="${instance}"}[5m])`,

  fanSpeed: (instance: string) =>
    `{job="temperature",instance="${instance}",type="fan"}`,

  nodeUp: (instance: string) => `up{instance="${instance}"}`,

  allNodesUp: () => `up{job!~"kube-state-metrics|kubernetes-apiservers|kubernetes-cadvisor|kubernetes-sevice-endpoints"}`,

  loadAvg1: (instance: string) => `machine_cpu_cores{instance="${instance}"}`,
  loadAvg5: (instance: string) => `machine_cpu_cores{instance="${instance}"}`,
  loadAvg15: (instance: string) => `machine_cpu_cores{instance="${instance}"}`,

  normalizedLoad: (instance: string) =>
    `sum(rate(container_cpu_usage_seconds_total{instance="${instance}",id="/"}[5m])) / scalar(machine_cpu_cores{instance="${instance}"})`,

  cpuModeUser: (instance: string) =>
    `rate(container_cpu_user_seconds_total{instance="${instance}",id="/"}[5m]) / scalar(machine_cpu_cores{instance="${instance}"}) * 100`,
  cpuModeSystem: (instance: string) =>
    `rate(container_cpu_system_seconds_total{instance="${instance}",id="/"}[5m]) / scalar(machine_cpu_cores{instance="${instance}"}) * 100`,
  cpuModeIowait: (instance: string) =>
    `rate(container_cpu_usage_seconds_total{instance="${instance}",id="/"}[5m]) * 0`,
  cpuModeSteal: (instance: string) =>
    `rate(container_cpu_usage_seconds_total{instance="${instance}",id="/"}[5m]) * 0`,

  memoryUsedBytes: (instance: string) =>
    `container_memory_working_set_bytes{instance="${instance}",id="/"}`,
  memoryCached: (instance: string) =>
    `container_memory_cache{instance="${instance}",id="/"}`,

  diskReadIOPS: (instance: string) =>
    `rate(container_fs_reads_total{instance="${instance}",id="/"}[5m])`,
  diskWriteIOPS: (instance: string) =>
    `rate(container_fs_writes_total{instance="${instance}",id="/"}[5m])`,

  diskReadLatency: (instance: string) =>
    `rate(container_fs_read_seconds_total{instance="${instance}",id="/"}[5m]) * 1000`,
  diskWriteLatency: (instance: string) =>
    `rate(container_fs_write_seconds_total{instance="${instance}",id="/"}[5m]) * 1000`,

  diskIOQueue: (instance: string) =>
    `container_fs_io_current{instance="${instance}",id="/"}`,

  networkRxErrors: (instance: string) =>
    `rate(container_network_receive_errors_total{instance="${instance}",interface!~"lo|veth.*|cni.*|docker.*|br-.*"}[5m])`,
  networkTxErrors: (instance: string) =>
    `rate(container_network_transmit_errors_total{instance="${instance}",interface!~"lo|veth.*|cni.*|docker.*|br-.*"}[5m])`,
  networkRxDrops: (instance: string) =>
    `rate(container_network_receive_packets_dropped_total{instance="${instance}",interface!~"lo|veth.*|cni.*|docker.*|br-.*"}[5m])`,
  networkTxDrops: (instance: string) =>
    `rate(container_network_transmit_packets_dropped_total{instance="${instance}",interface!~"lo|veth.*|cni.*|docker.*|br-.*"}[5m])`,

  tcpEstablished: (instance: string) =>
    `container_network_tcp_usage_total{instance="${instance}",tcp_state="established"}`,
  tcpRetransmits: (instance: string) =>
    `container_network_tcp_usage_total{instance="${instance}",tcp_state="close_wait"}`,

  inletTemp: (instance: string) =>
    `{job="temperature",instance="${instance}",type=~"inlet|ambient"}`,
  exhaustTemp: (instance: string) =>
    `{job="temperature",instance="${instance}",type=~"exhaust|outlet"}`,
  cpuSocketTemp: (instance: string) =>
    `{job="temperature",instance="${instance}",type=~"cpu|processor"}`,

  procsRunning: (instance: string) => `machine_cpu_cores{instance="${instance}"}`,
  procsBlocked: (instance: string) => `machine_cpu_cores{instance="${instance}"} * 0`,
  fileDescriptorUsage: (instance: string) =>
    `container_file_descriptors{instance="${instance}",id="/"} / process_open_fds{instance="${instance}"} * 100`,

  // ---- Dashboard fleet-wide aggregations ----
  fleetTotalPower: () => `sum(rate(Package_Joules_Consumed[5m]))`,
  fleetAvgMemory: () =>
    `sum(container_memory_working_set_bytes{id="/"}) / sum(machine_memory_bytes) * 100`,
  fleetTotalNetworkRx: () =>
    `sum(rate(container_network_receive_bytes_total{interface!~"veth.*|lo|cni.*|docker.*|br-.*"}[5m]))`,
  fleetTotalNetworkTx: () =>
    `sum(rate(container_network_transmit_bytes_total{interface!~"veth.*|lo|cni.*|docker.*|br-.*"}[5m]))`,
  fleetTopCpu: () =>
    `topk(5, sum by(instance)(rate(container_cpu_usage_seconds_total{id="/"}[5m])) / on(instance) group_left() machine_cpu_cores * 100)`,
};
