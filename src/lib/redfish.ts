/**
 * Minimal Redfish client for power control.
 *
 * Uses node:https directly so we can ignore self-signed BMC certificates
 * (the default in internal networks) without pulling in extra dependencies
 * or polluting NODE_TLS_REJECT_UNAUTHORIZED globally.
 *
 * Only the operations we actually call from the UI are implemented:
 *   - getPowerState()  → On / Off / Unknown
 *   - resetSystem()    → On, ForceOff, GracefulShutdown, GracefulRestart, ForceRestart
 */

import * as https from "node:https";

export type ResetType =
  | "On"
  | "ForceOn"
  | "ForceOff"
  | "GracefulShutdown"
  | "GracefulRestart"
  | "ForceRestart"
  | "Nmi"
  | "PowerCycle";

export type PowerState = "On" | "Off" | "PoweringOn" | "PoweringOff" | "Unknown";

export interface RedfishOptions {
  host: string;
  username: string;
  password: string;
  /** Reject self-signed certs. Default false (BMCs almost always use them). */
  strictTls?: boolean;
  /** Per-request timeout. Default 5000ms. */
  timeoutMs?: number;
}

export class RedfishError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "RedfishError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT = 5_000;

interface RedfishResponse<T> {
  status: number;
  data: T;
}

function bmcRequest<T = unknown>(
  opts: RedfishOptions,
  method: "GET" | "POST",
  path: string,
  body?: object,
): Promise<RedfishResponse<T>> {
  return new Promise((resolve, reject) => {
    const auth =
      "Basic " +
      Buffer.from(`${opts.username}:${opts.password}`).toString("base64");

    const requestOptions: https.RequestOptions = {
      host: opts.host,
      path,
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        "OData-Version": "4.0",
      },
      rejectUnauthorized: opts.strictTls === true,
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT,
    };

    const req = https.request(requestOptions, (res) => {
      let chunks = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (chunks += c));
      res.on("end", () => {
        const status = res.statusCode || 0;
        if (!chunks) {
          resolve({ status, data: {} as T });
          return;
        }
        try {
          resolve({ status, data: JSON.parse(chunks) as T });
        } catch {
          reject(
            new RedfishError(
              `Invalid JSON from BMC ${opts.host}: ${chunks.slice(0, 80)}`,
              status,
            ),
          );
        }
      });
    });

    req.on("error", (err) =>
      reject(new RedfishError(`BMC ${opts.host}: ${err.message}`)),
    );
    req.on("timeout", () => {
      req.destroy();
      reject(
        new RedfishError(
          `BMC ${opts.host}: request timed out after ${opts.timeoutMs ?? DEFAULT_TIMEOUT}ms`,
        ),
      );
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

interface SystemsCollection {
  Members?: Array<{ "@odata.id": string }>;
}

interface SystemDetail {
  PowerState?: string;
  Manufacturer?: string;
  Model?: string;
  SKU?: string;
  SerialNumber?: string;
  BiosVersion?: string;
  UUID?: string;
  HostName?: string;
  ProcessorSummary?: {
    Count?: number;
    Model?: string;
    CoreCount?: number;
    ThreadCount?: number;
  };
  MemorySummary?: {
    TotalSystemMemoryGiB?: number;
    Status?: { Health?: string };
  };
  Processors?: { "@odata.id"?: string };
  Memory?: { "@odata.id"?: string };
  EthernetInterfaces?: { "@odata.id"?: string };
}

/**
 * Pure helper, exported for unit tests:
 * pulls the first System URI out of a Systems collection payload.
 */
export function pickFirstSystemPath(
  collection: SystemsCollection,
): string | null {
  const member = collection.Members?.[0]?.["@odata.id"];
  return member || null;
}

async function discoverSystemPath(opts: RedfishOptions): Promise<string> {
  const res = await bmcRequest<SystemsCollection>(
    opts,
    "GET",
    "/redfish/v1/Systems",
  );
  if (res.status === 401) {
    throw new RedfishError("BMC authentication failed (401)", 401);
  }
  if (res.status !== 200) {
    throw new RedfishError(
      `Failed to enumerate Systems (HTTP ${res.status})`,
      res.status,
    );
  }
  const path = pickFirstSystemPath(res.data);
  if (!path) {
    throw new RedfishError("BMC returned an empty Systems collection");
  }
  return path;
}

/**
 * Read the current power state of the BMC's primary computer system.
 */
export async function getPowerState(
  opts: RedfishOptions,
): Promise<PowerState> {
  const systemPath = await discoverSystemPath(opts);
  const res = await bmcRequest<SystemDetail>(opts, "GET", systemPath);
  if (res.status !== 200) {
    throw new RedfishError(
      `Failed to read system state (HTTP ${res.status})`,
      res.status,
    );
  }
  return (res.data.PowerState as PowerState) || "Unknown";
}

/**
 * Issue a power reset action against the BMC's primary computer system.
 * Possible ResetType values are defined by the Redfish ComputerSystem schema.
 */
export interface ResetResult {
  status: number;
  systemPath: string;
  actionUrl: string;
  response: unknown;
}

export async function resetSystem(
  opts: RedfishOptions,
  resetType: ResetType,
): Promise<ResetResult> {
  const systemPath = await discoverSystemPath(opts);
  const actionUrl = `${systemPath}/Actions/ComputerSystem.Reset`;
  const res = await bmcRequest(
    opts,
    "POST",
    actionUrl,
    { ResetType: resetType },
  );
  if (res.status >= 400) {
    throw new RedfishError(
      `Reset action failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`,
      res.status,
    );
  }
  return {
    status: res.status,
    systemPath,
    actionUrl,
    response: res.data,
  };
}

export interface SystemHwInfo {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  biosVersion: string | null;
  uuid: string | null;
  powerState: PowerState;
  cpuModel: string | null;
  cpuCount: number | null;
  cpuCoreCount: number | null;
  cpuThreadCount: number | null;
  totalMemoryGiB: number | null;
  cpus: RedfishCpuInfo[];
  memories: RedfishMemoryInfo[];
  networkInterfaces: RedfishNicInfo[];
}

export interface RedfishCpuInfo {
  socket: string | null;
  manufacturer: string | null;
  model: string | null;
  cores: number | null;
  threads: number | null;
  maxSpeedMhz: number | null;
  tdpWatts: number | null;
  architecture: string | null;
}

export interface RedfishMemoryInfo {
  slotName: string | null;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string | null;
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

export interface RedfishNicInfo {
  name: string | null;
  macAddress: string | null;
  speedMbps: number | null;
  linkStatus: string | null;
  ipv4Address: string | null;
}

interface MemoryDetail {
  Id?: string;
  Name?: string;
  DeviceLocator?: string;
  MemoryDeviceType?: string;
  MemoryType?: string;
  CapacityMiB?: number;
  Manufacturer?: string;
  PartNumber?: string;
  SerialNumber?: string;
  OperatingSpeedMhz?: number;
  AllowedSpeedsMHz?: number[];
  RankCount?: number;
  DataWidthBits?: number;
  BusWidthBits?: number;
  ErrorCorrection?: string;
  BaseModuleType?: string;
  MemoryMedia?: string[];
  OperatingMemoryModes?: string[];
  Oem?: Record<string, unknown>;
  Status?: { State?: string; Health?: string };
}

interface EthernetDetail {
  Id?: string;
  Name?: string;
  MACAddress?: string;
  SpeedMbps?: number;
  LinkStatus?: string;
  Status?: { State?: string; Health?: string };
  IPv4Addresses?: Array<{ Address?: string }>;
}

interface ProcessorDetail {
  Id?: string;
  Socket?: string;
  Manufacturer?: string;
  Model?: string;
  Description?: string;
  ProcessorType?: string;
  TotalCores?: number;
  TotalThreads?: number;
  MaxSpeedMHz?: number;
  TDPWatts?: number;
  InstructionSet?: string;
  ProcessorArchitecture?: string;
  ProcessorId?: {
    VendorId?: string;
    EffectiveFamily?: string;
    EffectiveModel?: string;
    IdentificationRegisters?: string;
  };
  Oem?: Record<string, unknown>;
  Status?: { State?: string };
}

export interface RedfishThermalSensor {
  name: string;
  readingCelsius: number | null;
  upperCritical: number | null;
  upperFatal: number | null;
  status: string | null;
}

export interface RedfishFanSensor {
  name: string;
  reading: number | null;
  readingUnits: string | null;
  status: string | null;
}

export interface RedfishPowerSupply {
  name: string;
  model: string | null;
  capacityWatts: number | null;
  type: string | null;
  status: string | null;
}

export interface RedfishPowerControl {
  consumedWatts: number | null;
  capacityWatts: number | null;
  limitWatts: number | null;
}

export interface RedfishSensorsData {
  temperatures: RedfishThermalSensor[];
  fans: RedfishFanSensor[];
  powerSupplies: RedfishPowerSupply[];
  powerControl: RedfishPowerControl | null;
}

interface ThermalResponse {
  Temperatures?: Array<{
    Name?: string;
    ReadingCelsius?: number;
    UpperThresholdCritical?: number;
    UpperThresholdFatal?: number;
    Status?: { State?: string; Health?: string };
  }>;
  Fans?: Array<{
    Name?: string;
    Reading?: number;
    ReadingUnits?: string;
    Status?: { State?: string; Health?: string };
  }>;
}

interface PowerResponse {
  PowerSupplies?: Array<{
    Name?: string;
    Model?: string;
    PowerCapacityWatts?: number;
    PowerSupplyType?: string;
    Status?: { State?: string; Health?: string };
  }>;
  PowerControl?: Array<{
    PowerConsumedWatts?: number;
    PowerCapacityWatts?: number;
    PowerLimit?: { LimitInWatts?: number };
  }>;
}

interface CollectionResponse {
  Members?: Array<{ "@odata.id": string }>;
}

export async function getSystemHwInfo(
  opts: RedfishOptions,
): Promise<SystemHwInfo> {
  const systemPath = await discoverSystemPath(opts);
  const res = await bmcRequest<SystemDetail>(opts, "GET", systemPath);
  if (res.status === 401) {
    throw new RedfishError("BMC authentication failed (401)", 401);
  }
  if (res.status !== 200) {
    throw new RedfishError(
      `Failed to read system info (HTTP ${res.status})`,
      res.status,
    );
  }

  const sys = res.data;
  const cpus: RedfishCpuInfo[] = [];

  if (sys.Processors?.["@odata.id"]) {
    try {
      const procCol = await bmcRequest<CollectionResponse>(
        opts,
        "GET",
        sys.Processors["@odata.id"],
      );
      if (procCol.status === 200 && procCol.data.Members) {
        for (const member of procCol.data.Members) {
          try {
            const procRes = await bmcRequest<ProcessorDetail>(
              opts,
              "GET",
              member["@odata.id"],
            );
            if (procRes.status === 200) {
              const p = procRes.data;
              if (p.Status?.State === "Absent") continue;
              const model =
                p.Model ||
                p.Description ||
                p.ProcessorId?.EffectiveFamily ||
                sys.ProcessorSummary?.Model ||
                null;
              const cores =
                p.TotalCores ||
                (sys.ProcessorSummary?.CoreCount && sys.ProcessorSummary?.Count
                  ? Math.round(sys.ProcessorSummary.CoreCount / sys.ProcessorSummary.Count)
                  : sys.ProcessorSummary?.CoreCount) ||
                null;
              const threads =
                p.TotalThreads ||
                (sys.ProcessorSummary?.ThreadCount && sys.ProcessorSummary?.Count
                  ? Math.round(sys.ProcessorSummary.ThreadCount / sys.ProcessorSummary.Count)
                  : sys.ProcessorSummary?.ThreadCount) ||
                cores;
              cpus.push({
                socket: p.Socket || p.Id || null,
                manufacturer: p.Manufacturer || p.ProcessorId?.VendorId || null,
                model,
                cores,
                threads,
                maxSpeedMhz: p.MaxSpeedMHz || null,
                tdpWatts: p.TDPWatts || null,
                architecture: p.ProcessorArchitecture || p.InstructionSet || null,
              });
            }
          } catch (err) {
            console.warn("[redfish] failed to parse processor member", err);
          }
        }
      }
    } catch (err) {
      console.warn("[redfish] failed to fetch processor collection", err);
    }
  }

  const memories: RedfishMemoryInfo[] = [];
  if (sys.Memory?.["@odata.id"]) {
    try {
      const memCol = await bmcRequest<CollectionResponse>(
        opts,
        "GET",
        sys.Memory["@odata.id"],
      );
      if (memCol.status === 200 && memCol.data.Members) {
        for (const member of memCol.data.Members) {
          try {
            const memRes = await bmcRequest<MemoryDetail>(
              opts,
              "GET",
              member["@odata.id"],
            );
            if (memRes.status === 200) {
              const m = memRes.data;
              const isAbsent = m.Status?.State === "Absent";
              const capacityMiB = m.CapacityMiB || 0;
              memories.push({
                slotName: m.DeviceLocator || m.Name || m.Id || null,
                populated: !isAbsent && capacityMiB > 0,
                capacityGb: capacityMiB > 0 ? Math.round(capacityMiB / 1024) : null,
                memoryType: m.MemoryDeviceType || m.MemoryType || null,
                manufacturer: m.Manufacturer?.trim() || null,
                partNumber: m.PartNumber?.trim() || null,
                serialNumber: m.SerialNumber?.trim() || null,
                speedMhz: m.AllowedSpeedsMHz?.[0] || m.OperatingSpeedMhz || null,
                currentSpeedMhz: m.OperatingSpeedMhz || null,
                rank: m.RankCount || null,
                eccEnabled: m.ErrorCorrection
                  ? m.ErrorCorrection !== "NoECC"
                  : null,
                formFactor: m.BaseModuleType || null,
                voltage: null,
              });
            }
          } catch (err) {
            console.warn("[redfish] failed to parse memory member", err);
          }
        }
      }
    } catch (err) {
      console.warn("[redfish] failed to fetch memory collection", err);
    }
  }

  const networkInterfaces: RedfishNicInfo[] = [];
  if (sys.EthernetInterfaces?.["@odata.id"]) {
    try {
      const nicCol = await bmcRequest<CollectionResponse>(
        opts,
        "GET",
        sys.EthernetInterfaces["@odata.id"],
      );
      if (nicCol.status === 200 && nicCol.data.Members) {
        for (const member of nicCol.data.Members) {
          try {
            const nicRes = await bmcRequest<EthernetDetail>(
              opts,
              "GET",
              member["@odata.id"],
            );
            if (nicRes.status === 200) {
              const n = nicRes.data;
              if (n.Status?.State === "Absent") continue;
              const speedStr = n.SpeedMbps
                ? n.SpeedMbps >= 1000
                  ? `${n.SpeedMbps / 1000}G`
                  : `${n.SpeedMbps}M`
                : null;
              networkInterfaces.push({
                name: n.Name || n.Id || null,
                macAddress: n.MACAddress || null,
                speedMbps: n.SpeedMbps || null,
                linkStatus: n.LinkStatus || null,
                ipv4Address: n.IPv4Addresses?.[0]?.Address || null,
              });
            }
          } catch (err) {
            console.warn("[redfish] failed to parse network interface member", err);
          }
        }
      }
    } catch (err) {
      console.warn("[redfish] failed to fetch network interface collection", err);
    }
  }

  return {
    manufacturer: sys.Manufacturer || null,
    model: sys.Model || null,
    serialNumber: sys.SerialNumber || null,
    biosVersion: sys.BiosVersion || null,
    uuid: sys.UUID || null,
    powerState: (sys.PowerState as PowerState) || "Unknown",
    cpuModel: sys.ProcessorSummary?.Model || cpus[0]?.model || null,
    cpuCount: sys.ProcessorSummary?.Count || cpus.length || null,
    cpuCoreCount: sys.ProcessorSummary?.CoreCount || null,
    cpuThreadCount: sys.ProcessorSummary?.ThreadCount || null,
    totalMemoryGiB: sys.MemorySummary?.TotalSystemMemoryGiB || null,
    cpus,
    memories,
    networkInterfaces,
  };
}

/**
 * Fetch live thermal (temperatures, fans) and power (PSU, consumption)
 * from Redfish Chassis/1/Thermal and Chassis/1/Power.
 */
export async function getSensorsData(
  opts: RedfishOptions,
): Promise<RedfishSensorsData> {
  const temperatures: RedfishThermalSensor[] = [];
  const fans: RedfishFanSensor[] = [];
  const powerSupplies: RedfishPowerSupply[] = [];
  let powerControl: RedfishPowerControl | null = null;

  try {
    const thermalRes = await bmcRequest<ThermalResponse>(
      opts,
      "GET",
      "/redfish/v1/Chassis/1/Thermal",
    );
    if (thermalRes.status === 200) {
      for (const t of thermalRes.data.Temperatures || []) {
        if (!t.Name) continue;
        temperatures.push({
          name: t.Name,
          readingCelsius: t.ReadingCelsius ?? null,
          upperCritical: t.UpperThresholdCritical ?? null,
          upperFatal: t.UpperThresholdFatal ?? null,
          status: t.Status?.Health || null,
        });
      }
      for (const f of thermalRes.data.Fans || []) {
        if (!f.Name) continue;
        fans.push({
          name: f.Name,
          reading: f.Reading ?? null,
          readingUnits: f.ReadingUnits || "RPM",
          status: f.Status?.Health || null,
        });
      }
    }
  } catch (err) {
    console.warn("[redfish] failed to fetch thermal data", err);
  }

  try {
    const powerRes = await bmcRequest<PowerResponse>(
      opts,
      "GET",
      "/redfish/v1/Chassis/1/Power",
    );
    if (powerRes.status === 200) {
      for (const p of powerRes.data.PowerSupplies || []) {
        powerSupplies.push({
          name: p.Name || "PSU",
          model: p.Model || null,
          capacityWatts: p.PowerCapacityWatts ?? null,
          type: p.PowerSupplyType || null,
          status: p.Status?.Health || null,
        });
      }
      const ctrl = powerRes.data.PowerControl?.[0];
      if (ctrl) {
        powerControl = {
          consumedWatts: ctrl.PowerConsumedWatts ?? null,
          capacityWatts: ctrl.PowerCapacityWatts ?? null,
          limitWatts: ctrl.PowerLimit?.LimitInWatts ?? null,
        };
      }
    }
  } catch (err) {
    console.warn("[redfish] failed to fetch power data", err);
  }

  return { temperatures, fans, powerSupplies, powerControl };
}
