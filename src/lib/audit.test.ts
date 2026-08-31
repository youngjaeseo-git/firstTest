import { describe, it, expect, beforeEach, vi } from "vitest";
import { logAudit, diffShallow } from "./audit";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db");

const mockedCreate = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  // Inject auditLog mock onto the mocked prisma object
  (prisma as unknown as { auditLog: { create: typeof mockedCreate } }).auditLog = {
    create: mockedCreate,
  };
});

describe("logAudit", () => {
  it("forwards a complete audit input to prisma.auditLog.create", async () => {
    mockedCreate.mockResolvedValue({});
    await logAudit({
      userId: "user-1",
      action: "POWER_ACTION",
      entityType: "Equipment",
      entityId: "eq-42",
      changes: { resetType: "GracefulRestart", success: true },
      reason: "Kernel patch",
      ticketRef: "OPS-1234",
    });

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "POWER_ACTION",
        entityType: "Equipment",
        entityId: "eq-42",
        changes: { resetType: "GracefulRestart", success: true },
        reason: "Kernel patch",
        ticketRef: "OPS-1234",
      },
    });
  });

  it("does not throw when prisma rejects (audit must never break callers)", async () => {
    mockedCreate.mockRejectedValue(new Error("db down"));
    await expect(
      logAudit({
        userId: "user-1",
        action: "CREATE",
        entityType: "Equipment",
        entityId: "eq-42",
      }),
    ).resolves.toBeUndefined();
  });

  it("nullifies optional fields when not provided", async () => {
    mockedCreate.mockResolvedValue({});
    await logAudit({
      userId: "user-1",
      action: "CREATE",
      entityType: "Equipment",
      entityId: "eq-42",
    });
    const call = mockedCreate.mock.calls[0][0];
    expect(call.data.reason).toBeNull();
    expect(call.data.ticketRef).toBeNull();
    expect(call.data.changes).toBeUndefined();
  });
});

describe("diffShallow", () => {
  it("returns only changed keys with from/to", () => {
    expect(
      diffShallow(
        { hostname: "old", status: "ACTIVE", rackId: "r1" },
        { hostname: "new", status: "ACTIVE", rackId: "r1" },
      ),
    ).toEqual({
      hostname: { from: "old", to: "new" },
    });
  });

  it("captures additions and removals", () => {
    expect(diffShallow({ a: 1 }, { b: 2 })).toEqual({
      a: { from: 1, to: undefined },
      b: { from: undefined, to: 2 },
    });
  });

  it("returns an empty object when nothing changed", () => {
    expect(diffShallow({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual({});
  });
});
