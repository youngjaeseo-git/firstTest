/**
 * Prometheus HTTP API client
 *
 * Queries Prometheus for server metrics and auto-discovery.
 * Prometheus URL: http://10.100.175.248:8080 (K8s ClusterIP)
 *
 * Query strategy: node-exporter first, cAdvisor fallback via PromQL "or".
 * Instance label mismatch: cAdvisor uses hostnames, node-exporter uses IP:port.
 * The hostIp parameter resolves this by providing the IP for node-exporter matching.
 */

import type { PrometheusQueryResult } from "@/types/metrics";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL || "http://10.100.175.248:8080";

const FETCH_TIMEOUT_MS = 10000;

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
      discoveredLabels: Record<string, string>;
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
  address: string | null;
}

export async function fetchTargets(): Promise<DiscoveredPrometheusTarget[]> {
  const url = new URL("/api/v1/targets", PROMETHEUS_URL);

  const res = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Prometheus targets fetch failed: ${res.statusText}`);
  }

  const data: PrometheusTargetsResponse = await res.json();

  if (data.status !== "success" || !Array.isArray(data.data?.activeTargets)) {
    throw new Error("Prometheus targets response malformed or returned an error status");
  }

  return data.data.activeTargets.map((target) => {
    const rawAddr = target.discoveredLabels?.__address__ || "";
    const addrIp = rawAddr.split(":")[0] || null;
    return {
      instance: target.labels.instance || target.scrapeUrl,
      job: target.labels.job || target.scrapePool,
      labels: target.labels,
      health: target.health,
      lastScrape: target.lastScrape,
      scrapeUrl: target.scrapeUrl,
      address: addrIp,
    };
  });
}

// ============================================
// Instance Matchers
// ============================================

// Escape PromQL regex metacharacters so an IP like 10.144.38.1 does not
// cross-match 10.144.38.10/11/... (dots are regex "any char" otherwise).
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extract the host portion of an instance and escape it for use in a regex matcher.
function ip(instance: string): string {
  return escapeRe(instance.split(":")[0]);
}

// cAdvisor/general matcher: matches hostname or IP regardless of port
function m(instance: string): string {
  return `instance=~"${ip(instance)}(:.*)?"`;
}

// cAdvisor matcher with container filter
function cm(instance: string): string {
  return `${m(instance)},container!=""`;
}

// node-exporter matcher: uses hostIp if provided (resolves hostname vs IP mismatch)
function ne(instance: string, hostIp?: string): string {
  const addr = hostIp ? escapeRe(hostIp) : ip(instance);
  return `instance=~"${addr}(:.*)?",job="node-exporter"`;
}

const NE_JOB = `job="node-exporter"`;
const VNIC = `device!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"`;
const FS_REAL = `fstype!~"tmpfs|devtmpfs|overlay|squashfs|proc|sysfs|autofs|rootfs",mountpoint!~"/dev.*|/sys.*|/proc.*|/run.*|/host/dev.*|/host/sys.*|/host/proc.*|/host/run.*"`;
const DISK_REAL = `device=~"/dev/mapper/.*|/dev/md.*|/dev/sd.*|/dev/nvme.*"`;

// ============================================
// Cluster (Lab) Filter
// ============================================

export type Cluster = "all" | "lab1" | "lab3";

const CLUSTER_NE: Record<Cluster, string> = {
  all: NE_JOB,
  lab1: `${NE_JOB},instance=~"10.144.38..*"`,
  lab3: `${NE_JOB},instance=~"10.144.131..*"`,
};

const CLUSTER_CA: Record<Cluster, string> = {
  all: `container!=""`,
  lab1: `container!="",instance=~".*13ae.*|.*14ae.*|k8-master"`,
  lab3: `container!="",instance=~".*131.*"`,
};

const CLUSTER_UP: Record<Cluster, string> = {
  all: `job!~"kube-state-metrics|kubernetes-apiservers|kubernetes-cadvisor|kubernetes-service-endpoints"`,
  lab1: `job!~"kube-state-metrics|kubernetes-apiservers|kubernetes-cadvisor|kubernetes-service-endpoints",instance=~"10.144.38..*|.*13ae.*|.*14ae.*|k8-master"`,
  lab3: `job!~"kube-state-metrics|kubernetes-apiservers|kubernetes-cadvisor|kubernetes-service-endpoints",instance=~"10.144.131..*"`,
};

function neC(cluster: Cluster): string {
  return CLUSTER_NE[cluster];
}

function caC(cluster: Cluster): string {
  return CLUSTER_CA[cluster];
}

// ============================================
// Common PromQL Queries
// node-exporter first, cAdvisor fallback via "or"
// ============================================

export const queries = {
  // ── CPU ──
  cpuUsage: (instance: string, hostIp?: string) =>
    `(1 - avg(rate(node_cpu_seconds_total{mode="idle",${ne(instance, hostIp)}}[5m]))) * 100` +
    ` or ` +
    `sum(rate(container_cpu_usage_seconds_total{${cm(instance)}}[5m])) / scalar(max(machine_cpu_cores{${m(instance)}})) * 100`,

  cpuPerCore: (instance: string, hostIp?: string) =>
    `(1 - avg by(cpu)(rate(node_cpu_seconds_total{mode="idle",${ne(instance, hostIp)}}[5m]))) * 100` +
    ` or ` +
    `sum by(cpu)(rate(container_cpu_usage_seconds_total{${cm(instance)},cpu!="total"}[5m])) * 100`,

  cpuPerPod: (instance: string) =>
    `sort_desc(sum by(pod, namespace)(rate(container_cpu_usage_seconds_total{${cm(instance)}}[5m])))`,

  loadAvg1: (instance: string, hostIp?: string) =>
    `node_load1{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(rate(container_cpu_usage_seconds_total{${cm(instance)}}[1m]))`,

  loadAvg5: (instance: string, hostIp?: string) =>
    `node_load5{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(rate(container_cpu_usage_seconds_total{${cm(instance)}}[5m]))`,

  loadAvg15: (instance: string, hostIp?: string) =>
    `node_load15{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(rate(container_cpu_usage_seconds_total{${cm(instance)}}[15m]))`,

  cpuCoreCount: (instance: string, hostIp?: string) =>
    `count(node_cpu_seconds_total{mode="idle",${ne(instance, hostIp)}})` +
    ` or ` +
    `max(machine_cpu_cores{${m(instance)}})`,

  normalizedLoad: (instance: string, hostIp?: string) =>
    `node_load1{${ne(instance, hostIp)}} / count(node_cpu_seconds_total{mode="idle",${ne(instance, hostIp)}})` +
    ` or ` +
    `sum(rate(container_cpu_usage_seconds_total{${cm(instance)}}[5m])) / scalar(max(machine_cpu_cores{${m(instance)}}))`,

  cpuModeUser: (instance: string, hostIp?: string) =>
    `avg(rate(node_cpu_seconds_total{mode="user",${ne(instance, hostIp)}}[5m])) * 100` +
    ` or ` +
    `sum(rate(container_cpu_user_seconds_total{${cm(instance)}}[5m])) / scalar(max(machine_cpu_cores{${m(instance)}})) * 100`,

  cpuModeSystem: (instance: string, hostIp?: string) =>
    `avg(rate(node_cpu_seconds_total{mode="system",${ne(instance, hostIp)}}[5m])) * 100` +
    ` or ` +
    `sum(rate(container_cpu_system_seconds_total{${cm(instance)}}[5m])) / scalar(max(machine_cpu_cores{${m(instance)}})) * 100`,

  cpuModeIowait: (instance: string, hostIp?: string) =>
    `avg(rate(node_cpu_seconds_total{mode="iowait",${ne(instance, hostIp)}}[5m])) * 100` +
    ` or ` +
    `sum(rate(container_cpu_cfs_throttled_seconds_total{${cm(instance)}}[5m]))`,

  cpuModeSteal: (instance: string, hostIp?: string) =>
    `avg(rate(node_cpu_seconds_total{mode="steal",${ne(instance, hostIp)}}[5m])) * 100`,

  // ── Memory ──
  memoryUsage: (instance: string, hostIp?: string) =>
    `(1 - node_memory_MemAvailable_bytes{${ne(instance, hostIp)}} / node_memory_MemTotal_bytes{${ne(instance, hostIp)}}) * 100` +
    ` or ` +
    `sum(container_memory_working_set_bytes{${cm(instance)}}) / sum(machine_memory_bytes{${m(instance)}}) * 100`,

  memoryTotal: (instance: string, hostIp?: string) =>
    `node_memory_MemTotal_bytes{${ne(instance, hostIp)}}` +
    ` or ` +
    `max(machine_memory_bytes{${m(instance)}})`,

  memoryAvailable: (instance: string, hostIp?: string) =>
    `node_memory_MemAvailable_bytes{${ne(instance, hostIp)}}` +
    ` or ` +
    `max(machine_memory_bytes{${m(instance)}}) - sum(container_memory_working_set_bytes{${cm(instance)}})`,

  memoryUsedBytes: (instance: string, hostIp?: string) =>
    `node_memory_MemTotal_bytes{${ne(instance, hostIp)}} - node_memory_MemAvailable_bytes{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(container_memory_working_set_bytes{${cm(instance)}})`,

  memoryCached: (instance: string, hostIp?: string) =>
    `node_memory_Cached_bytes{${ne(instance, hostIp)}} + node_memory_Buffers_bytes{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(container_memory_cache{${cm(instance)}})`,

  swapUsage: (instance: string, hostIp?: string) =>
    `node_memory_SwapTotal_bytes{${ne(instance, hostIp)}} - node_memory_SwapFree_bytes{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(container_memory_swap{${cm(instance)}})`,

  // ── Disk ──
  diskUsage: (instance: string) =>
    `sum(container_fs_usage_bytes{${cm(instance)}}) / sum(container_fs_limit_bytes{${cm(instance)}}) * 100`,

  diskIORead: (instance: string, hostIp?: string) =>
    `sum(rate(node_disk_read_bytes_total{${ne(instance, hostIp)}}[5m]))` +
    ` or ` +
    `sum(rate(container_fs_reads_bytes_total{${cm(instance)}}[5m]))`,

  diskIOWrite: (instance: string, hostIp?: string) =>
    `sum(rate(node_disk_written_bytes_total{${ne(instance, hostIp)}}[5m]))` +
    ` or ` +
    `sum(rate(container_fs_writes_bytes_total{${cm(instance)}}[5m]))`,

  diskReadIOPS: (instance: string, hostIp?: string) =>
    `sum(rate(node_disk_reads_completed_total{${ne(instance, hostIp)}}[5m]))` +
    ` or ` +
    `sum(rate(container_fs_reads_total{${cm(instance)}}[5m]))`,

  diskWriteIOPS: (instance: string, hostIp?: string) =>
    `sum(rate(node_disk_writes_completed_total{${ne(instance, hostIp)}}[5m]))` +
    ` or ` +
    `sum(rate(container_fs_writes_total{${cm(instance)}}[5m]))`,

  diskReadLatency: (instance: string, hostIp?: string) =>
    `sum(rate(node_disk_read_time_seconds_total{${ne(instance, hostIp)}}[5m])) / clamp_min(sum(rate(node_disk_reads_completed_total{${ne(instance, hostIp)}}[5m])), 0.001) * 1000` +
    ` or ` +
    `sum(rate(container_fs_read_seconds_total{${cm(instance)}}[5m])) * 1000`,

  diskWriteLatency: (instance: string, hostIp?: string) =>
    `sum(rate(node_disk_write_time_seconds_total{${ne(instance, hostIp)}}[5m])) / clamp_min(sum(rate(node_disk_writes_completed_total{${ne(instance, hostIp)}}[5m])), 0.001) * 1000` +
    ` or ` +
    `sum(rate(container_fs_write_seconds_total{${cm(instance)}}[5m])) * 1000`,

  diskIOQueue: (instance: string) =>
    `sum(container_fs_io_current{${cm(instance)}})`,

  hostDiskUsage: (instance: string, hostIp?: string) =>
    `(1 - sum(node_filesystem_avail_bytes{${ne(instance, hostIp)},mountpoint="/",${FS_REAL}}) / sum(node_filesystem_size_bytes{${ne(instance, hostIp)},mountpoint="/",${FS_REAL}})) * 100` +
    ` or ` +
    `sum(container_fs_usage_bytes{${m(instance)},${DISK_REAL}}) / sum(container_fs_limit_bytes{${m(instance)},${DISK_REAL}}) * 100`,

  hostDiskUsedBytes: (instance: string, hostIp?: string) =>
    `sum(node_filesystem_size_bytes{${ne(instance, hostIp)},mountpoint="/",${FS_REAL}}) - sum(node_filesystem_avail_bytes{${ne(instance, hostIp)},mountpoint="/",${FS_REAL}})` +
    ` or ` +
    `sum(container_fs_usage_bytes{${m(instance)},${DISK_REAL}})`,

  hostDiskTotalBytes: (instance: string, hostIp?: string) =>
    `sum(node_filesystem_size_bytes{${ne(instance, hostIp)},mountpoint="/",${FS_REAL}})` +
    ` or ` +
    `sum(container_fs_limit_bytes{${m(instance)},${DISK_REAL}})`,

  // ── Network ──
  networkRx: (instance: string, hostIp?: string) =>
    `sum(rate(node_network_receive_bytes_total{${ne(instance, hostIp)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_receive_bytes_total{${m(instance)},interface!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))`,

  networkTx: (instance: string, hostIp?: string) =>
    `sum(rate(node_network_transmit_bytes_total{${ne(instance, hostIp)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_transmit_bytes_total{${m(instance)},interface!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))`,

  networkRxErrors: (instance: string, hostIp?: string) =>
    `sum(rate(node_network_receive_errs_total{${ne(instance, hostIp)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_receive_errors_total{${m(instance)},interface!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))`,

  networkTxErrors: (instance: string, hostIp?: string) =>
    `sum(rate(node_network_transmit_errs_total{${ne(instance, hostIp)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_transmit_errors_total{${m(instance)},interface!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))`,

  networkRxDrops: (instance: string, hostIp?: string) =>
    `sum(rate(node_network_receive_drop_total{${ne(instance, hostIp)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_receive_packets_dropped_total{${m(instance)},interface!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))`,

  networkTxDrops: (instance: string, hostIp?: string) =>
    `sum(rate(node_network_transmit_drop_total{${ne(instance, hostIp)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_transmit_packets_dropped_total{${m(instance)},interface!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))`,

  tcpEstablished: (instance: string, hostIp?: string) =>
    `node_netstat_Tcp_CurrEstab{${ne(instance, hostIp)}}` +
    ` or ` +
    `sum(container_network_tcp_usage_total{${m(instance)},tcp_state="established"})`,

  tcpRetransmits: (instance: string, hostIp?: string) =>
    `rate(node_netstat_TcpExt_TCPRetransSegs{${ne(instance, hostIp)}}[5m])` +
    ` or ` +
    `sum(container_network_tcp_usage_total{${m(instance)},tcp_state="close_wait"})`,

  // ── Hardware / Thermal ──
  temperature: (instance: string, hostIp?: string) =>
    `node_hwmon_temp_celsius{${ne(instance, hostIp)}}` +
    ` or ` +
    `{job="temperature",${m(instance)}}`,

  inletTemp: (instance: string) =>
    `{job="temperature",${m(instance)},type=~"inlet|ambient"}`,

  exhaustTemp: (instance: string) =>
    `{job="temperature",${m(instance)},type=~"exhaust|outlet"}`,

  cpuSocketTemp: (instance: string) =>
    `{job="temperature",${m(instance)},type=~"cpu|processor"}`,

  fanSpeed: (instance: string, hostIp?: string) =>
    `node_hwmon_fan_rpm{${ne(instance, hostIp)}}` +
    ` or ` +
    `{job="temperature",${m(instance)},type="fan"}`,

  powerWatts: (instance: string) =>
    `rate(Package_Joules_Consumed{${m(instance)}}[5m])`,

  powerDramWatts: (instance: string) =>
    `rate(DRAM_Joules_Consumed{${m(instance)}}[5m])`,

  powerPP0Watts: (instance: string) =>
    `rate(PP0_Joules_Consumed{${m(instance)}}[5m])`,

  // ── PCM (Intel Performance Counter Monitor) ──
  pcmIPC: (instance: string) =>
    `sum(rate(Instructions_Retired_Any{${m(instance)}}[5m])) / sum(rate(Clock_Unhalted_Ref{${m(instance)}}[5m]))`,

  pcmL2HitRate: (instance: string) =>
    `sum(rate(L2_Cache_Hits{${m(instance)}}[5m])) / (sum(rate(L2_Cache_Hits{${m(instance)}}[5m])) + sum(rate(L2_Cache_Misses{${m(instance)}}[5m]))) * 100`,

  pcmL3HitRate: (instance: string) =>
    `sum(rate(L3_Cache_Hits{${m(instance)}}[5m])) / (sum(rate(L3_Cache_Hits{${m(instance)}}[5m])) + sum(rate(L3_Cache_Misses{${m(instance)}}[5m]))) * 100`,

  pcmDRAMReads: (instance: string) =>
    `sum(rate(DRAM_Reads{${m(instance)}}[5m]))`,

  pcmDRAMWrites: (instance: string) =>
    `sum(rate(DRAM_Writes{${m(instance)}}[5m]))`,

  // ── System / Uptime ──
  uptime: (instance: string, hostIp?: string) =>
    `time() - node_boot_time_seconds{${ne(instance, hostIp)}}` +
    ` or ` +
    `time() - min(container_start_time_seconds{${cm(instance)}})`,

  bootTime: (instance: string, hostIp?: string) =>
    `node_boot_time_seconds{${ne(instance, hostIp)}}`,

  // ── Status ──
  nodeUp: (instance: string) => `up{${m(instance)}}`,

  allNodesUp: () => `up{job!~"kube-state-metrics|kubernetes-apiservers|kubernetes-cadvisor|kubernetes-service-endpoints"}`,

  nodeExporterUp: (instance: string, hostIp?: string) =>
    `up{${ne(instance, hostIp)}}`,

  cadvisorUp: (instance: string) =>
    `up{job="kubernetes-cadvisor",${m(instance)}}`,

  // ── Filesystem breakdown (node-exporter only) ──
  filesystemSize: (instance: string, hostIp?: string) =>
    `node_filesystem_size_bytes{${ne(instance, hostIp)},${FS_REAL}}`,

  filesystemAvail: (instance: string, hostIp?: string) =>
    `node_filesystem_avail_bytes{${ne(instance, hostIp)},${FS_REAL}}`,

  // ── Network interface inventory (node-exporter only) ──
  networkInterfaceUp: (instance: string, hostIp?: string) =>
    `node_network_up{${ne(instance, hostIp)},${VNIC}}`,

  networkInterfaceSpeed: (instance: string, hostIp?: string) =>
    `node_network_speed_bytes{${ne(instance, hostIp)},${VNIC}}`,

  networkInterfaceInfo: (instance: string, hostIp?: string) =>
    `node_network_info{${ne(instance, hostIp)},${VNIC}}`,

  // ── Process / System ──
  procsRunning: (instance: string, hostIp?: string) =>
    `node_procs_running{${ne(instance, hostIp)}}` +
    ` or ` +
    `max(machine_cpu_cores{${m(instance)}})`,

  procsBlocked: (instance: string, hostIp?: string) =>
    `node_procs_blocked{${ne(instance, hostIp)}}` +
    ` or ` +
    `max(machine_cpu_cores{${m(instance)}}) * 0`,

  fileDescriptorUsage: (instance: string, hostIp?: string) =>
    `node_filefd_allocated{${ne(instance, hostIp)}} / node_filefd_maximum{${ne(instance, hostIp)}} * 100` +
    ` or ` +
    `sum(container_file_descriptors{${cm(instance)}}) / sum(process_open_fds{${m(instance)}}) * 100`,

  // ── kube-state-metrics: node-level capacity ──
  nodeCapacityCpu: (instance: string) =>
    `kube_node_status_capacity{resource="cpu",node=~"${ip(instance)}.*"}`,
  nodeCapacityMemory: (instance: string) =>
    `kube_node_status_capacity{resource="memory",node=~"${ip(instance)}.*"}`,
  nodeCapacityDisk: (instance: string) =>
    `kube_node_status_capacity{resource="ephemeral_storage",node=~"${ip(instance)}.*"}`,
  nodeAllocatableCpu: (instance: string) =>
    `kube_node_status_allocatable{resource="cpu",node=~"${ip(instance)}.*"}`,
  nodeAllocatableMemory: (instance: string) =>
    `kube_node_status_allocatable{resource="memory",node=~"${ip(instance)}.*"}`,
  kubeletRunningPods: (instance: string) =>
    `kubelet_running_pods{instance=~"${ip(instance)}(:.*)?"}`,
  nodePodList: (instance: string) =>
    `kube_pod_info{node=~"${ip(instance)}.*"}`,

  // ── Dashboard fleet-wide aggregations (node-exporter first, cAdvisor fallback) ──
  // All fleet queries accept optional cluster filter
  fleetAvgTemp: () =>
    `avg(node_hwmon_temp_celsius)`,
  fleetTotalPower: () =>
    `sum(node_hmon_power_average_watt) or sum(rate(Package_Joules_Consumed[5m]))`,
  fleetAvgMemory: (cluster: Cluster = "all") =>
    `(1 - sum(node_memory_MemAvailable_bytes{${neC(cluster)}}) / sum(node_memory_MemTotal_bytes{${neC(cluster)}})) * 100` +
    ` or ` +
    `sum(container_memory_working_set_bytes{${caC(cluster)}}) / sum(machine_memory_bytes) * 100`,
  fleetTotalNetworkRx: (cluster: Cluster = "all") =>
    `sum(rate(node_network_receive_bytes_total{${neC(cluster)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_receive_bytes_total{${caC(cluster)},interface!~"veth.*|lo|cni.*|docker.*|br-.*"}[5m]))`,
  fleetTotalNetworkTx: (cluster: Cluster = "all") =>
    `sum(rate(node_network_transmit_bytes_total{${neC(cluster)},${VNIC}}[5m]))` +
    ` or ` +
    `sum(rate(container_network_transmit_bytes_total{${caC(cluster)},interface!~"veth.*|lo|cni.*|docker.*|br-.*"}[5m]))`,
  fleetAvgCpu: (cluster: Cluster = "all") =>
    `(1 - avg(rate(node_cpu_seconds_total{mode="idle",${neC(cluster)},instance=~".+:[0-9]+"}[5m]))) * 100` +
    ` or ` +
    `sum(rate(container_cpu_usage_seconds_total{${caC(cluster)}}[5m])) / sum(machine_cpu_cores) * 100`,
  fleetTotalMemoryUsedBytes: (cluster: Cluster = "all") =>
    `sum(node_memory_MemTotal_bytes{${neC(cluster)},instance=~".+:[0-9]+"}` +
    ` - node_memory_MemAvailable_bytes{${neC(cluster)},instance=~".+:[0-9]+"})` +
    ` or ` +
    `sum(container_memory_working_set_bytes{${caC(cluster)}})`,
  fleetTotalMemoryBytes: (cluster: Cluster = "all") =>
    `sum(node_memory_MemTotal_bytes{${neC(cluster)},instance=~".+:[0-9]+"})` +
    ` or ` +
    `sum(machine_memory_bytes)`,
  fleetTotalCpuCores: (cluster: Cluster = "all") =>
    `count(node_cpu_seconds_total{mode="idle",${neC(cluster)},instance=~".+:[0-9]+"})` +
    ` or ` +
    `sum(machine_cpu_cores)`,
  fleetTopCpu: (cluster: Cluster = "all") =>
    `topk(10, (1 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle",${neC(cluster)},instance=~".+:[0-9]+"}[5m]))) * 100)`,
  fleetTopCpuCadvisor: (cluster: Cluster = "all") =>
    `topk(10, sum by(instance)(rate(container_cpu_usage_seconds_total{${caC(cluster)}}[5m])) / on(instance) group_left() machine_cpu_cores * 100)`,
  fleetTopMemory: (cluster: Cluster = "all") =>
    `topk(10, (1 - node_memory_MemAvailable_bytes{${neC(cluster)},instance=~".+:[0-9]+"} / node_memory_MemTotal_bytes{${neC(cluster)},instance=~".+:[0-9]+"}) * 100)`,
  fleetTopMemoryCadvisor: (cluster: Cluster = "all") =>
    `topk(10, sum by(instance)(container_memory_working_set_bytes{${caC(cluster)}}) / on(instance) group_left() machine_memory_bytes * 100)`,
  fleetAvgUptime: (cluster: Cluster = "all") =>
    `avg(time() - node_boot_time_seconds{${neC(cluster)}})` +
    ` or ` +
    `avg(time() - min by(instance)(container_start_time_seconds{${caC(cluster)}}))`,
  allNodesUpFiltered: (cluster: Cluster = "all") =>
    `up{${CLUSTER_UP[cluster]}}`,

  fleetCpuPerInstance: () =>
    `(1 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100` +
    ` or ` +
    `sum by(instance)(rate(container_cpu_usage_seconds_total{container!=""}[5m])) / on(instance) group_left() machine_cpu_cores * 100`,

  workloadPods: () =>
    `kube_pod_info{namespace!~"kube-system|monitoring|calico-system|calico-apiserver|tigera-operator"}`,
  workloadPodCreated: () =>
    `kube_pod_created{namespace!~"kube-system|monitoring|calico-system|calico-apiserver|tigera-operator"}`,
  workloadPodPhase: () =>
    `kube_pod_status_phase{namespace!~"kube-system|monitoring|calico-system|calico-apiserver|tigera-operator"}==1`,
  workloadPodWaitingReason: () =>
    `kube_pod_container_status_waiting_reason{namespace!~"kube-system|monitoring|calico-system|calico-apiserver|tigera-operator"}==1`,
};
