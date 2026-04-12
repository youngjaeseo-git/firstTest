import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db");

function makeRequest(q: string | null) {
  const url = q
    ? `http://localhost:3001/api/search?q=${encodeURIComponent(q)}`
    : "http://localhost:3001/api/search";
  return new NextRequest(url);
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (prisma.equipment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.room.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.rack.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("returns empty groups when query is missing", async () => {
    const res = await GET(makeRequest(null));
    const body = await res.json();

    expect(body).toEqual({ servers: [], rooms: [], racks: [], alerts: [] });
    expect(prisma.equipment.findMany).not.toHaveBeenCalled();
  });

  it("returns empty groups when query is too short (< 2 chars)", async () => {
    const res = await GET(makeRequest("a"));
    const body = await res.json();

    expect(body).toEqual({ servers: [], rooms: [], racks: [], alerts: [] });
    expect(prisma.equipment.findMany).not.toHaveBeenCalled();
  });

  it("queries all tables in parallel when query is valid", async () => {
    await GET(makeRequest("web"));

    expect(prisma.equipment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.room.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.rack.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.alert.findMany).toHaveBeenCalledTimes(1);
  });

  it("only returns FIRING alerts", async () => {
    await GET(makeRequest("cpu"));

    const alertCall = (prisma.alert.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(alertCall.where.status).toBe("FIRING");
  });

  it("maps equipment results with fallback hostname to ipAddress or Unknown", async () => {
    (prisma.equipment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "1",
        hostname: "web-01",
        ipAddress: "10.0.0.1",
        type: "SERVER",
        status: "ACTIVE",
      },
      {
        id: "2",
        hostname: null,
        ipAddress: "10.0.0.2",
        type: "SERVER",
        status: "ACTIVE",
      },
      {
        id: "3",
        hostname: null,
        ipAddress: null,
        type: "SERVER",
        status: "ACTIVE",
      },
    ]);

    const res = await GET(makeRequest("web"));
    const body = await res.json();

    expect(body.servers).toHaveLength(3);
    expect(body.servers[0].hostname).toBe("web-01");
    expect(body.servers[1].hostname).toBe("10.0.0.2");
    expect(body.servers[2].hostname).toBe("Unknown");
  });

  it("trims whitespace from query", async () => {
    const res = await GET(makeRequest("  a  "));
    const body = await res.json();

    // "a" trimmed is length 1, so empty result
    expect(body).toEqual({ servers: [], rooms: [], racks: [], alerts: [] });
  });

  it("flattens rack results with roomName", async () => {
    (prisma.rack.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "r1",
        name: "B03",
        room: { name: "Server Room A" },
      },
    ]);

    const res = await GET(makeRequest("B0"));
    const body = await res.json();

    expect(body.racks).toEqual([
      { id: "r1", name: "B03", roomName: "Server Room A" },
    ]);
  });

  it("limits each category to 5 results", async () => {
    await GET(makeRequest("test"));

    const equipmentCall = (prisma.equipment.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(equipmentCall.take).toBe(5);
  });
});
