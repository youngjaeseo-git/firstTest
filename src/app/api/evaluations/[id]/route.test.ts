import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db");
vi.mock("@/lib/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rbac")>()),
  getSessionUser: vi.fn(),
}));

import { DELETE } from "./route";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";

type Role = "ADMIN" | "OPERATOR" | "VIEWER";
const asUser = (role: Role) => ({ id: "u1", email: "e", name: "n", role, orgIds: [] });
const ctx = { params: Promise.resolve({ id: "ep-1" }) };
const delReq = () => new NextRequest("http://localhost:3001/api/evaluations/ep-1", { method: "DELETE" });

const del = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  (prisma as any).evalProject = { delete: del };
  del.mockResolvedValue({ id: "ep-1" });
});

describe("DELETE /api/evaluations/[id] — S1 삭제 권한(ADMIN 전용)", () => {
  it("VIEWER는 삭제 불가(403), DB 삭제 없음", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("VIEWER"));

    const res = await DELETE(delReq(), ctx);

    expect(res.status).toBe(403);
    expect(del).not.toHaveBeenCalled();
  });

  it("OPERATOR도 삭제 불가(403) — canDelete는 ADMIN 전용", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("OPERATOR"));

    const res = await DELETE(delReq(), ctx);

    expect(res.status).toBe(403);
    expect(del).not.toHaveBeenCalled();
  });

  it("ADMIN은 삭제 가능", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("ADMIN"));

    const res = await DELETE(delReq(), ctx);

    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledTimes(1);
  });
});
