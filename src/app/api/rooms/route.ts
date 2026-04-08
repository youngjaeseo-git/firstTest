import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rooms = await prisma.room.findMany({
    include: {
      dataCenter: true,
      racks: {
        include: {
          _count: { select: { equipment: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(rooms);
}
