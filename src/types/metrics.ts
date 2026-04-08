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

// ============================================
// Server Metrics (from Prometheus)
// ============================================

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

// ============================================
// Dashboard
// ============================================

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

// ============================================
// CPU Detail Types
// ============================================

export interface CpuInfo {
  id: string;
  socketIndex: number;
  manufacturer: string | null;
  model: string | null;
  cores: number | null;
  threads: number | null;
  baseFreqMhz: number | null;
  maxFreqMhz: number | null;
  architecture: string | null;
  tdpWatts: number | null;
}

// ============================================
// Memory Detail Types (HIGH PRIORITY)
// ============================================

export interface MemorySummary {
  totalSlots: number;
  populatedSlots: number;
  emptySlots: number;
  totalCapacityGb: number;
  memoryTypes: string[]; // unique types found (e.g., ["DDR5"])
  manufacturers: string[]; // unique manufacturers
  maxSpeedMhz: number | null;
  eccEnabled: boolean;
}

export interface DimmSlotInfo {
  id: string;
  slotName: string;
  slotIndex: number;
  populated: boolean;
  capacityGb: number | null;
  memoryType: MemoryTypeLabel | null;
  manufacturer: string | null;
  partNumber: string | null;
  serialNumber: string | null;
  speedMhz: number | null;
  currentSpeedMhz: number | null;
  rank: number | null;
  eccEnabled: boolean | null;
  formFactor: string | null;
  voltage: number | null;
}

export type MemoryTypeLabel =
  | "DDR3"
  | "DDR4"
  | "DDR5"
  | "HBM"
  | "HBM2"
  | "HBM2E"
  | "HBM3"
  | "LPDDR4"
  | "LPDDR5";

// Grouped by CPU socket for the memory detail page
export interface MemorySocketGroup {
  socketIndex: number;
  cpuModel: string | null;
  slots: DimmSlotInfo[];
  populatedCount: number;
  totalCapacityGb: number;
}

// ============================================
// Equipment Detail Types
// ============================================

export type EquipmentLifecycleStatus =
  | "PLANNED"
  | "RECEIVING"
  | "INSTALLED"
  | "ACTIVE"
  | "MAINTENANCE"
  | "REPAIR"
  | "FAILED"
  | "DECOMMISSIONED"
  | "DISPOSED";

export interface EquipmentDetail {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  type: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  assetTag: string | null;
  status: EquipmentLifecycleStatus;
  osType: string | null;
  osVersion: string | null;
  biosVersion: string | null;
  bmcIpAddress: string | null;
  totalMemoryGB: number | null;
  rackId: string | null;
  rackPosition: number | null;
  rackHeight: number;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
  cpus: CpuInfo[];
  memorySummary: MemorySummary;
}

// ============================================
// Digital Twin Types
// ============================================

export interface RoomLayout {
  roomId: string;
  roomName: string;
  description: string | null;
  racks: RackPosition[];
}

export interface RackPosition {
  rackId: string;
  rackName: string;
  rowLabel: string | null;
  sortOrder: number;
  positionX: number | null;
  positionY: number | null;
  totalUnits: number;
  usedUnits: number;
  avgTemperature: number | null;
  equipmentCount: number;
}

// Rack heatmap / elevation data
export interface RackElevationData {
  rackId: string;
  rackName: string;
  totalUnits: number;
  units: RackUnitSlot[];
}

export interface RackUnitSlot {
  position: number; // U position (1 = bottom)
  occupied: boolean;
  equipmentId: string | null;
  equipmentName: string | null;
  equipmentType: string | null;
  equipmentStatus: EquipmentLifecycleStatus | null;
  rackHeight: number; // 1 for non-start positions of multi-U equipment
  isStartPosition: boolean; // true for the first U of multi-U equipment
  temperature: number | null;
}

// ============================================
// Prometheus Discovery Types
// ============================================

export interface DiscoveredTarget {
  instance: string;
  job: string;
  labels: Record<string, string>;
  health: "up" | "down" | "unknown";
  lastScrape: string;
  scrapeUrl: string;
  linked: boolean; // whether linked to an Equipment record
  equipmentId: string | null;
}

export interface DiscoverySyncResult {
  discovered: number;
  newTargets: number;
  updated: number;
  removed: number;
}
