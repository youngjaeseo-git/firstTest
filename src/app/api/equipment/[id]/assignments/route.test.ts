import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db");
vi.mock("@/lib/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rbac")>()),
  getSessionUser: vi.fn(),
}));

import { POST } from "./route";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";

type Role = "ADMIN" | "OPERATOR" | "VIEWER";
const asUser = (role: Role, orgIds: string[] = ["org-1"]) => ({ id: "u1", email: "e", name: "n", role, orgIds });
const ctx = { params: Promise.resolve({ id: "eq-1" }) };

function postReq(body: unknown) {
  return new NextRequest("http://localhost:3001/api/equipment/eq-1/assignments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const createAssign = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  (prisma as any).equipmentAssignment = { create: createAssign };
  (prisma.equipment.findUnique as any).mockResolvedValue({ id: "eq-1", organizationId: "org-1" });
  createAssign.mockResolvedValue({ id: "asg-1" });
});

describe("POST /api/equipment/[id]/assignments — S2 역할 가드", () => {
  it("VIEWER는 할당 생성 불가(403), DB 쓰기 없음", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("VIEWER"));

    const res = await POST(postReq({ assignedTo: "alice" }), ctx);

    expect(res.status).toBe(403);
    expect(createAssign).not.toHaveBeenCalled();
  });

  it("소속 조직 OPERATOR는 할당 생성 가능(201)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("OPERATOR", ["org-1"]));

    const res = await POST(postReq({ assignedTo: "alice" }), ctx);

    expect(res.status).toBe(201);
    expect(createAssign).toHaveBeenCalledTimes(1);
  });

  it("역할이 있어도 비소속 조직이면 차단(403) — 역할·조직 이중 가드", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("OPERATOR", ["org-2"]));

    const res = await POST(postReq({ assignedTo: "alice" }), ctx);

    expect(res.status).toBe(403);
    expect(createAssign).not.toHaveBeenCalled();
  });
});
