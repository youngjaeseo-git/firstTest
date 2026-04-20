import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = {
    alerts: 0,
    equipmentMemory: 0,
    equipmentCpu: 0,
    equipment: 0,
  };

  deleted.alerts = (await prisma.alert.deleteMany({})).count;

  deleted.equipmentMemory = (
    await prisma.equipmentMemory.deleteMany({
      where: { equipment: { id: { startsWith: "server-" } } },
    })
  ).count;

  deleted.equipmentCpu = (
    await prisma.equipmentCpu.deleteMany({
      where: { equipment: { id: { startsWith: "server-" } } },
    })
  ).count;

  deleted.equipment = (
    await prisma.equipment.deleteMany({
      where: { id: { startsWith: "server-" } },
    })
  ).count;

  return NextResponse.json({
    message: "Seed data cleaned up",
    deleted,
    preserved: ["users", "dataCenter", "rooms", "racks"],
  });
}
