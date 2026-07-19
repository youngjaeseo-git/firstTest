import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// getSessionUser 만 스텁하고, canEdit 등 실제 권한 함수는 살린다.
vi.mock("@/lib/db");
vi.mock("@/lib/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rbac")>()),
  getSessionUser: vi.fn(),
}));

import { POST } from "./route";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";

type Role = "ADMIN" | "OPERATOR" | "VIEWER";
const asUser = (role: Role) => ({ id: "u1", email: "e", name: "n", role, orgIds: [] });

function postReq(body: unknown) {
  return new NextRequest("http://localhost:3001/api/evaluations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const create = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  (prisma as any).evalProject = { create };
  create.mockResolvedValue({ id: "ep-1", title: "T", phases: [] });
});

describe("POST /api/evaluations — S1 역할 가드", () => {
  it("VIEWER는 생성 불가(403)이고 DB 쓰기가 일어나지 않는다", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("VIEWER"));

    const res = await POST(postReq({ title: "eval", evalType: "FIELD" }));

    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("미인증(null)도 차단된다", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const res = await POST(postReq({ title: "eval", evalType: "FIELD" }));

    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("OPERATOR는 생성 가능(201)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("OPERATOR"));

    const res = await POST(postReq({ title: "eval", evalType: "FIELD" }));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("ADMIN은 생성 가능(201)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asUser("ADMIN"));

    const res = await POST(postReq({ title: "eval", evalType: "FIELD" }));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
