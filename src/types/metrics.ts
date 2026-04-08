// Prometheus metric types used across the application

export interface PrometheusQueryResult {
  status: "success" | "error";
  data: {
    resultType: "matrix" | "vector" | "scalar" | "string";
    result: PrometheusMetric[];
  };
}

export interface PrometheusMetric {
  metric: Record<string, string>;
  value?: [number, string]; // [timestamp, value] for instant query
  values?: [number, string][]; // for range query
}

// Server metrics as displayed in the UI
export interface ServerMetrics {
  cpuUsage: number; // percentage 0-100
  cpuCores: CoreMetric[];
  memoryUsage: number; // percentage
  memoryTotal: number; // bytes
  memoryUsed: number; // bytes
  swapUsage: number;
  diskUsage: DiskMetric[];
  networkInterfaces: NetworkMetric[];
  temperatures: TemperatureSensor[];
  pcieBandwidth: PcieBandwidthMetric[];
  powerConsumption: number; // watts
  fanSpeeds: FanMetric[];
  uptime: number; // seconds
}

export interface CoreMetric {
  core: number;
  usage: number;
}

export interface DiskMetric {
  mountpoint: string;
  device: string;
  totalBytes: number;
  usedBytes: number;
  readBytesPerSec: number;
  writeBytesPerSec: number;
  iops: number;
}

export interface NetworkMetric {
  interface: string;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  rxErrors: number;
  txErrors: number;
  speed: string; // e.g. "10G"
}

export interface TemperatureSensor {
  name: string;
  location: string; // "CPU", "GPU", "Inlet", "Outlet", "Board"
  value: number; // celsius
  warningThreshold: number;
  criticalThreshold: number;
}

export interface PcieBandwidthMetric {
  slot: string;
  device: string;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  maxBandwidth: number; // theoretical max
}

export interface FanMetric {
  name: string;
  rpm: number;
  percentage: number;
}

// Time range for metric queries
export type TimeRange =
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | { start: Date; end: Date };

// Dashboard summary
export interface DashboardSummary {
  totalServers: number;
  activeServers: number;
  warningServers: number;
  criticalServers: number;
  downServers: number;
  totalPowerWatts: number;
  pue: number;
  avgTemperature: number;
  activeAlerts: number;
  networkThroughput: {
    inbound: number;
    outbound: number;
  };
}

// Rack heatmap data
export interface RackHeatmapData {
  rackId: string;
  rackName: string;
  units: {
    position: number;
    temperature: number | null;
    equipmentId: string | null;
    equipmentName: string | null;
  }[];
}
