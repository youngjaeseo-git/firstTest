import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetId } = await req.json();
  if (!targetId) {
    return NextResponse.json({ error: "targetId required" }, { status: 400 });
  }

  const target = await prisma.prometheusTarget.findUnique({
    where: { id: targetId },
  });

  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  if (target.equipmentId) {
    return NextResponse.json(
      { error: "Target already linked to equipment" },
      { status: 409 },
    );
  }

  const instanceHost = target.instance.split(":")[0];

  const equipment = await prisma.equipment.create({
    data: {
      hostname: target.hostname || instanceHost,
      ipAddress: instanceHost,
      type: "SERVER",
      status: target.health === "up" ? "ACTIVE" : "INSTALLED",
      prometheusInstance: target.instance,
      prometheusTarget: { connect: { id: target.id } },
    },
  });

  return NextResponse.json({ equipment });
}
