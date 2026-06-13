import type { PrometheusQueryResult } from "@/types/metrics";
import type { DiscoveredPrometheusTarget } from "./prometheus";

const DEMO_SERVERS = [
  { ip: "10.144.38.61", hostname: "s222hax13ae001", job: "node-exporter" },
  { ip: "10.144.38.62", hostname: "s222hax13ae002", job: "node-exporter" },
  { ip: "10.144.38.63", hostname: "s222hax13ae003", job: "node-exporter" },
  { ip: "10.144.38.64", hostname: "s222hax13ae004", job: "node-exporter" },
  { ip: "10.144.38.65", hostname: "s222hax13ae005", job: "node-exporter" },
  { ip: "10.144.38.71", hostname: "s222hx14ae001", job: "node-exporter" },
  { ip: "10.144.38.72", hostname: "s222hx14ae002", job: "node-exporter" },
  { ip: "10.144.38.73", hostname: "s222hx14ae003", job: "node-exporter" },
  { ip: "10.144.38.74", hostname: "s222hx14ae004", job: "node-exporter" },
  { ip: "10.144.38.75", hostname: "s222hx14ae005", job: "node-exporter" },
  { ip: "10.144.131.101", hostname: "s222hax14ae001", job: "node-exporter" },
  { ip: "10.144.131.102", hostname: "s222hax14ae002", job: "node-exporter" },
  { ip: "10.144.131.103", hostname: "s222hax14ae003", job: "node-exporter" },
  { ip: "10.144.131.111", hostname: "s222hx14ae001-lab3", job: "node-exporter" },
  { ip: "10.144.131.112", hostname: "s222hx14ae002-lab3", job: "node-exporter" },
  { ip: "10.144.131.113", hostname: "s222hx14ae003-lab3", job: "node-exporter" },
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function ts(): number {
  return Date.now() / 1000;
}

function scalar(value: number): PrometheusQueryResult {
  return {
    status: "success",
    data: {
      resultType: "vector",
      result: [{ metric: {}, value: [ts(), value.toFixed(4)] }],
    },
  };
}

function perInstance(
  values: { instance: string; value: number; extraLabels?: Record<string, string> }[],
): PrometheusQueryResult {
  return {
    status: "success",
    data: {
      resultType: "vector",
      result: values.map((v) => ({
        metric: { instance: v.instance, ...v.extraLabels },
        value: [ts(), v.value.toFixed(4)],
      })),
    },
  };
}

function generateRangeValues(
  baseValue: number,
  variance: number,
  durationMin: number,
  stepSec: number,
): [number, string][] {
  const points = Math.floor((durationMin * 60) / stepSec);
  const now = ts();
  const values: [number, string][] = [];
  let current = baseValue;
  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.5) * variance * 2;
    current = Math.max(0, Math.min(100, current));
    values.push([now - (points - i) * stepSec, current.toFixed(4)]);
  }
  return values;
}

function rangePerInstance(
  instances: { instance: string; base: number; variance: number; extraLabels?: Record<string, string> }[],
  durationMin: number,
  stepSec: number,
): PrometheusQueryResult {
  return {
    status: "success",
    data: {
      resultType: "matrix",
      result: instances.map((inst) => ({
        metric: { instance: inst.instance, ...inst.extraLabels },
        values: generateRangeValues(inst.base, inst.variance, durationMin, stepSec),
      })),
    },
  };
}

function matchQuery(query: string, patterns: string[]): boolean {
  return patterns.some((p) => query.includes(p));
}

export function demoInstantQuery(query: string): PrometheusQueryResult {
  if (matchQuery(query, ["fleetAvgCpu", "avg(rate(node_cpu_seconds_total", "1 - avg(rate(node_cpu"])) {
    if (query.includes("by(instance)") || query.includes("by (instance)")) {
      return perInstance(
        DEMO_SERVERS.map((s) => ({
          instance: `${s.ip}:9100`,
          value: rand(5, 85),
        })),
      );
    }
    if (query.includes("topk")) {
      return perInstance(
        DEMO_SERVERS.slice(0, 5).map((s) => ({
          instance: `${s.ip}:9100`,
          value: rand(60, 95),
        })),
      );
    }
    return scalar(rand(25, 65));
  }

  if (matchQuery(query, ["node_hwmon_temp_celsius", "fleetAvgTemp"])) {
    if (query.includes("avg by")) {
      return perInstance(
        DEMO_SERVERS.map((s) => ({
          instance: `${s.ip}:9100`,
          value: rand(35, 72),
        })),
      );
    }
    return scalar(rand(38, 55));
  }

  if (matchQuery(query, ["node_memory_MemAvailable", "MemTotal", "memory", "avgMemory"])) {
    if (query.includes("topk")) {
      return perInstance(
        DEMO_SERVERS.slice(0, 5).map((s) => ({
          instance: `${s.ip}:9100`,
          value: rand(50, 92),
        })),
      );
    }
    if (query.includes("MemTotal") && !query.includes("1 -") && !query.includes("MemAvail")) {
      return scalar(DEMO_SERVERS.length * 256 * 1024 * 1024 * 1024);
    }
    if (query.includes("MemAvailable") && !query.includes("1 -")) {
      return scalar(DEMO_SERVERS.length * 128 * 1024 * 1024 * 1024);
    }
    return scalar(rand(40, 70));
  }

  if (matchQuery(query, ["up{", "up "])) {
    return perInstance(
      DEMO_SERVERS.map((s) => ({
        instance: `${s.ip}:9100`,
        value: Math.random() > 0.05 ? 1 : 0,
        extraLabels: { job: s.job },
      })),
    );
  }
  if (query === "up") {
    return perInstance(
      DEMO_SERVERS.map((s) => ({
        instance: `${s.ip}:9100`,
        value: 1,
        extraLabels: { job: s.job },
      })),
    );
  }

  if (matchQuery(query, ["node_boot_time", "uptime", "avgUptime"])) {
    return scalar(rand(86400 * 7, 86400 * 90));
  }

  if (matchQuery(query, ["Package_Joules", "totalPower", "power"])) {
    return scalar(rand(800, 3500));
  }

  if (matchQuery(query, ["network_receive", "networkRx", "totalNetworkRx"])) {
    return scalar(rand(50000000, 500000000));
  }
  if (matchQuery(query, ["network_transmit", "networkTx", "totalNetworkTx"])) {
    return scalar(rand(30000000, 300000000));
  }

  if (matchQuery(query, ["node_cpu_seconds_total{mode=\"idle\""])) {
    if (query.includes("by(cpu)") || query.includes("by (cpu)")) {
      const cores = Array.from({ length: 64 }, (_, i) => ({
        instance: `${DEMO_SERVERS[0].ip}:9100`,
        value: rand(5, 95),
        extraLabels: { cpu: String(i) },
      }));
      return perInstance(cores);
    }
    return scalar(rand(20, 80));
  }

  if (matchQuery(query, ["node_load1"])) return scalar(rand(1, 20));
  if (matchQuery(query, ["node_load5"])) return scalar(rand(2, 18));
  if (matchQuery(query, ["node_load15"])) return scalar(rand(3, 15));

  if (matchQuery(query, ["count(node_cpu_seconds_total", "cpuCoreCount", "machine_cpu_cores"])) {
    return scalar(64);
  }

  if (matchQuery(query, ["node_disk_read_bytes", "diskIORead"])) return scalar(rand(10000000, 200000000));
  if (matchQuery(query, ["node_disk_written_bytes", "diskIOWrite"])) return scalar(rand(5000000, 150000000));
  if (matchQuery(query, ["node_disk_reads_completed", "diskReadIOPS"])) return scalar(rand(100, 5000));
  if (matchQuery(query, ["node_disk_writes_completed", "diskWriteIOPS"])) return scalar(rand(50, 3000));
  if (matchQuery(query, ["filesystem_size"])) {
    return perInstance([
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 2 * 1024 * 1024 * 1024 * 1024, extraLabels: { mountpoint: "/", device: "/dev/mapper/root" } },
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 500 * 1024 * 1024 * 1024, extraLabels: { mountpoint: "/boot", device: "/dev/sda1" } },
    ]);
  }
  if (matchQuery(query, ["filesystem_avail"])) {
    return perInstance([
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 1.2 * 1024 * 1024 * 1024 * 1024, extraLabels: { mountpoint: "/", device: "/dev/mapper/root" } },
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 400 * 1024 * 1024 * 1024, extraLabels: { mountpoint: "/boot", device: "/dev/sda1" } },
    ]);
  }

  if (matchQuery(query, ["container_cpu_usage", "rate(container_cpu"])) return scalar(rand(10, 60));
  if (matchQuery(query, ["container_memory_working_set"])) return scalar(rand(2000000000, 16000000000));
  if (matchQuery(query, ["container_network"])) return scalar(rand(1000000, 50000000));

  if (matchQuery(query, ["node_network_up"])) {
    return perInstance([
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 1, extraLabels: { device: "eth0" } },
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 1, extraLabels: { device: "eth1" } },
    ]);
  }
  if (matchQuery(query, ["node_network_speed"])) {
    return perInstance([
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 1250000000, extraLabels: { device: "eth0" } },
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: 1250000000, extraLabels: { device: "eth1" } },
    ]);
  }

  if (matchQuery(query, ["node_netstat_Tcp_CurrEstab", "tcpEstablished"])) return scalar(rand(50, 500));
  if (matchQuery(query, ["TcpRetransSegs", "tcpRetransmits"])) return scalar(rand(0, 5));

  if (matchQuery(query, ["Instructions_Retired", "IPC"])) return scalar(rand(0.8, 2.5));
  if (matchQuery(query, ["L2_Cache_Hits", "L2HitRate"])) return scalar(rand(85, 99));
  if (matchQuery(query, ["L3_Cache_Hits", "L3HitRate"])) return scalar(rand(70, 95));
  if (matchQuery(query, ["DRAM_Reads"])) return scalar(rand(1000000000, 10000000000));
  if (matchQuery(query, ["DRAM_Writes"])) return scalar(rand(500000000, 5000000000));
  if (matchQuery(query, ["PP0_Joules"])) return scalar(rand(50, 200));

  if (matchQuery(query, ["node_procs_running"])) return scalar(rand(1, 10));
  if (matchQuery(query, ["node_procs_blocked"])) return scalar(rand(0, 2));
  if (matchQuery(query, ["node_filefd"])) return scalar(rand(1, 15));

  if (matchQuery(query, ["node_uname_info"])) {
    return perInstance(
      DEMO_SERVERS.map((s) => ({
        instance: `${s.ip}:9100`,
        value: 1,
        extraLabels: { nodename: s.hostname },
      })),
    );
  }

  if (matchQuery(query, ["kube_pod_info"])) {
    const pods = [
      { pod: "nginx-deploy-7d8f9b", namespace: "default", node: DEMO_SERVERS[0].ip },
      { pod: "redis-master-0", namespace: "cache", node: DEMO_SERVERS[0].ip },
      { pod: "worker-job-abc12", namespace: "batch", node: DEMO_SERVERS[1].ip },
    ];
    return perInstance(
      pods.map((p) => ({
        instance: `${p.node}:9100`,
        value: 1,
        extraLabels: { pod: p.pod, namespace: p.namespace, node: p.node },
      })),
    );
  }

  if (matchQuery(query, ["kube_node_status"])) return scalar(64);
  if (matchQuery(query, ["kubelet_running_pods"])) return scalar(rand(5, 30));

  if (matchQuery(query, ["node_hwmon_fan_rpm", "fanSpeed"])) {
    return perInstance([
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: rand(3000, 8000), extraLabels: { chip: "Fan1" } },
      { instance: `${DEMO_SERVERS[0].ip}:9100`, value: rand(3000, 8000), extraLabels: { chip: "Fan2" } },
    ]);
  }

  if (matchQuery(query, ["swap"])) return scalar(rand(0, 1000000000));

  if (matchQuery(query, ["pue", "facility_power", "dcim_pue"])) {
    return scalar(rand(1.25, 1.45));
  }

  return scalar(rand(0, 100));
}

export function demoRangeQuery(
  query: string,
  durationMin: number,
  stepSec: number,
): PrometheusQueryResult {
  if (matchQuery(query, ["cpu", "CPU"])) {
    if (query.includes("by(cpu)") || query.includes("by (cpu)")) {
      return rangePerInstance(
        Array.from({ length: 8 }, (_, i) => ({
          instance: `${DEMO_SERVERS[0].ip}:9100`,
          base: rand(15, 70),
          variance: 8,
          extraLabels: { cpu: String(i) },
        })),
        durationMin,
        stepSec,
      );
    }
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(20, 60), variance: 10 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["memory", "Memory", "MemAvailable"])) {
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(40, 70), variance: 5 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["network_receive", "network_transmit"])) {
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(20, 80), variance: 15 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["disk_read", "disk_written", "disk_reads_completed", "disk_writes_completed"])) {
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(10, 50), variance: 10 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["temp", "hwmon"])) {
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(40, 60), variance: 3 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["load1", "load5", "load15"])) {
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(2, 12), variance: 2 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["Package_Joules", "power", "PP0"])) {
    return rangePerInstance(
      [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(100, 300), variance: 20 }],
      durationMin,
      stepSec,
    );
  }

  if (matchQuery(query, ["pue", "facility_power", "dcim_pue"])) {
    const points = Math.floor((durationMin * 60) / stepSec);
    const now = ts();
    const values: [number, string][] = [];
    let current = rand(1.30, 1.40);
    for (let i = 0; i < points; i++) {
      current += (Math.random() - 0.5) * 0.02;
      current = Math.max(1.1, Math.min(2.0, current));
      values.push([now - (points - i) * stepSec, current.toFixed(4)]);
    }
    return {
      status: "success",
      data: {
        resultType: "matrix",
        result: [{ metric: {}, values }],
      },
    };
  }

  return rangePerInstance(
    [{ instance: `${DEMO_SERVERS[0].ip}:9100`, base: rand(10, 60), variance: 10 }],
    durationMin,
    stepSec,
  );
}

export function demoFetchTargets(): DiscoveredPrometheusTarget[] {
  return DEMO_SERVERS.map((s) => ({
    instance: `${s.ip}:9100`,
    job: s.job,
    labels: { instance: `${s.ip}:9100`, job: s.job, __name__: "up" },
    health: (Math.random() > 0.05 ? "up" : "down") as "up" | "down",
    lastScrape: new Date().toISOString(),
    scrapeUrl: `http://${s.ip}:9100/metrics`,
    address: s.ip,
  }));
}
