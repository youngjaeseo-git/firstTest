import { describe, it, expect } from "vitest";
import { pickFirstSystemPath, RedfishError } from "./redfish";

describe("pickFirstSystemPath", () => {
  it("returns the first @odata.id from a Members array", () => {
    expect(
      pickFirstSystemPath({
        Members: [
          { "@odata.id": "/redfish/v1/Systems/System.Embedded.1" },
          { "@odata.id": "/redfish/v1/Systems/System.Embedded.2" },
        ],
      }),
    ).toBe("/redfish/v1/Systems/System.Embedded.1");
  });

  it("returns null when Members is missing", () => {
    expect(pickFirstSystemPath({})).toBeNull();
  });

  it("returns null when Members is empty", () => {
    expect(pickFirstSystemPath({ Members: [] })).toBeNull();
  });
});

describe("RedfishError", () => {
  it("captures status code", () => {
    const err = new RedfishError("auth failed", 401);
    expect(err.status).toBe(401);
    expect(err.message).toBe("auth failed");
    expect(err.name).toBe("RedfishError");
  });

  it("defaults status to 0 when not provided", () => {
    const err = new RedfishError("network");
    expect(err.status).toBe(0);
  });
});
