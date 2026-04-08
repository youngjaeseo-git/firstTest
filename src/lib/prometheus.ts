/**
 * Prometheus HTTP API client
 *
 * Queries Prometheus for server metrics.
 * Configure PROMETHEUS_URL in .env (e.g., http://prometheus:9090)
 */

import type { PrometheusQueryResult } from "@/types/metrics";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://localhost:9090";

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

// Common PromQL queries for server metrics
export const queries = {
  cpuUsage: (instance: string) =>
    `100 - (avg by(instance)(rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[5m])) * 100)`,

  cpuPerCore: (instance: string) =>
    `100 - (rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[5m]) * 100)`,

  memoryUsage: (instance: string) =>
    `(1 - node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"}) * 100`,

  memoryTotal: (instance: string) =>
    `node_memory_MemTotal_bytes{instance="${instance}"}`,

  diskUsage: (instance: string) =>
    `(1 - node_filesystem_avail_bytes{instance="${instance}",fstype!~"tmpfs|devtmpfs"} / node_filesystem_size_bytes{instance="${instance}",fstype!~"tmpfs|devtmpfs"}) * 100`,

  diskIO: (instance: string) =>
    `rate(node_disk_read_bytes_total{instance="${instance}"}[5m])`,

  networkRx: (instance: string) =>
    `rate(node_network_receive_bytes_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,

  networkTx: (instance: string) =>
    `rate(node_network_transmit_bytes_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])`,

  temperature: (instance: string) =>
    `node_hwmon_temp_celsius{instance="${instance}"}`,

  uptime: (instance: string) =>
    `node_time_seconds{instance="${instance}"} - node_boot_time_seconds{instance="${instance}"}`,

  // PDU / power metrics (SNMP-based or IPMI)
  powerWatts: (instance: string) =>
    `ipmi_power_watts{instance="${instance}"}`,

  fanSpeed: (instance: string) =>
    `ipmi_fan_speed_rpm{instance="${instance}"}`,
};
