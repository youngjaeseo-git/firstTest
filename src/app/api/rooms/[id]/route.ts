import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: {
      dataCenter: true,
      racks: {
        include: {
          equipment: {
            orderBy: { rackPosition: "asc" },
          },
          _count: { select: { equipment: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(room);
}
