/**
 * BMC credential resolution.
 *
 * Currently uses fleet-wide credentials from environment variables (suitable
 * for an internal network where all BMCs share the same admin account).
 *
 * Wrapped in a function so per-equipment overrides can be added later
 * (e.g. credential vault, per-vendor groups) without touching call sites.
 */

import type { Equipment } from "@prisma/client";

export interface BmcCredentials {
  username: string;
  password: string;
}

export class MissingBmcCredentialsError extends Error {
  constructor() {
    super(
      "BMC credentials not configured. Set BMC_USERNAME and BMC_PASSWORD in .env",
    );
    this.name = "MissingBmcCredentialsError";
  }
}

/**
 * Resolve BMC credentials for the given equipment.
 *
 * @throws {MissingBmcCredentialsError} when env vars are missing
 */
export function getBmcCredentials(_equipment: Equipment): BmcCredentials {
  const username = process.env.BMC_USERNAME;
  const password = process.env.BMC_PASSWORD;

  if (!username || !password) {
    throw new MissingBmcCredentialsError();
  }

  // Future: per-equipment override could go here. e.g.:
  //   if (_equipment.bmcCredentialId) return loadFromVault(...)
  return { username, password };
}

/**
 * Returns true when fleet-wide BMC credentials are configured.
 * Used by health checks / UI to disable controls gracefully.
 */
export function bmcCredentialsConfigured(): boolean {
  return Boolean(process.env.BMC_USERNAME && process.env.BMC_PASSWORD);
}
