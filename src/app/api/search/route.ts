import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({
      servers: [],
      rooms: [],
      racks: [],
      alerts: [],
    });
  }

  const limit = 5;

  const [servers, rooms, racks, alerts] = await Promise.all([
    prisma.equipment.findMany({
      where: {
        OR: [
          { hostname: { contains: q, mode: "insensitive" } },
          { ipAddress: { contains: q, mode: "insensitive" } },
          { serialNumber: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        hostname: true,
        ipAddress: true,
        type: true,
        status: true,
      },
      take: limit,
      orderBy: { hostname: "asc" },
    }),
    prisma.room.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      take: limit,
    }),
    prisma.rack.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        room: { select: { name: true } },
      },
      take: limit,
    }),
    prisma.alert.findMany({
      where: {
        status: "FIRING",
        summary: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        summary: true,
        severity: true,
        source: true,
      },
      take: limit,
      orderBy: { firedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    servers: servers.map((s) => ({
      id: s.id,
      hostname: s.hostname || s.ipAddress || "Unknown",
      ipAddress: s.ipAddress,
      type: s.type,
      status: s.status,
    })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    racks: racks.map((r) => ({
      id: r.id,
      name: r.name,
      roomName: r.room.name,
    })),
    alerts: alerts.map((a) => ({
      id: a.id,
      summary: a.summary,
      severity: a.severity,
      source: a.source,
    })),
  });
}
