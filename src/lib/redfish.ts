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
  | "ForceOff"
  | "GracefulShutdown"
  | "GracefulRestart"
  | "ForceRestart";

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

/** Destination URL for the BMC web console (opens in a new browser tab). */
export function bmcConsoleUrl(host: string): string {
  return `https://${host}`;
}
