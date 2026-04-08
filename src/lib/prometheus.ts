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
};
