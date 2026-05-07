import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const maxOrder = await prisma.evalPhase.aggregate({
    where: { projectId: id },
    _max: { sortOrder: true },
  });

  const phase = await prisma.evalPhase.create({
    data: {
      projectId: id,
      name: body.name,
      description: body.description || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });

  return NextResponse.json(phase, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.phaseId) {
    return NextResponse.json({ error: "phaseId required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("description" in body) data.description = body.description;
  if ("status" in body) data.status = body.status;
  if ("startDate" in body) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if ("endDate" in body) data.endDate = body.endDate ? new Date(body.endDate) : null;

  const phase = await prisma.evalPhase.update({
    where: { id: body.phaseId },
    data,
  });

  return NextResponse.json(phase);
}
