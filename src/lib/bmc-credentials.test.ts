import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Equipment } from "@prisma/client";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
  MissingBmcCredentialsError,
} from "./bmc-credentials";

const mockEquipment = { id: "eq1", bmcIpAddress: "10.0.0.1" } as Equipment;

describe("bmc-credentials", () => {
  let originalUser: string | undefined;
  let originalPass: string | undefined;

  beforeEach(() => {
    originalUser = process.env.BMC_USERNAME;
    originalPass = process.env.BMC_PASSWORD;
    delete process.env.BMC_USERNAME;
    delete process.env.BMC_PASSWORD;
  });

  afterEach(() => {
    if (originalUser !== undefined) process.env.BMC_USERNAME = originalUser;
    else delete process.env.BMC_USERNAME;
    if (originalPass !== undefined) process.env.BMC_PASSWORD = originalPass;
    else delete process.env.BMC_PASSWORD;
  });

  it("returns env-based credentials when both vars are set", () => {
    process.env.BMC_USERNAME = "root";
    process.env.BMC_PASSWORD = "calvin";
    expect(getBmcCredentials(mockEquipment)).toEqual({
      username: "root",
      password: "calvin",
    });
  });

  it("throws MissingBmcCredentialsError when username is missing", () => {
    process.env.BMC_PASSWORD = "calvin";
    expect(() => getBmcCredentials(mockEquipment)).toThrow(
      MissingBmcCredentialsError,
    );
  });

  it("throws MissingBmcCredentialsError when password is missing", () => {
    process.env.BMC_USERNAME = "root";
    expect(() => getBmcCredentials(mockEquipment)).toThrow(
      MissingBmcCredentialsError,
    );
  });

  it("bmcCredentialsConfigured returns false when env not set", () => {
    expect(bmcCredentialsConfigured()).toBe(false);
  });

  it("bmcCredentialsConfigured returns true when both env set", () => {
    process.env.BMC_USERNAME = "root";
    process.env.BMC_PASSWORD = "calvin";
    expect(bmcCredentialsConfigured()).toBe(true);
  });
});
