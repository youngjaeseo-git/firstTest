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
  if (!body.workloadName) {
    return NextResponse.json({ error: "workloadName required" }, { status: 400 });
  }

  const result = await prisma.evalResult.create({
    data: {
      projectId: id,
      phaseId: body.phaseId || null,
      equipmentId: body.equipmentId || null,
      workloadName: body.workloadName,
      workloadConfig: body.workloadConfig || null,
      cycleDuration: body.cycleDuration || null,
      totalCycles: body.totalCycles ? parseInt(body.totalCycles) : null,
      completedCycles: body.completedCycles ? parseInt(body.completedCycles) : null,
      result: body.result || "PENDING",
      value: body.value || null,
      unit: body.unit || null,
      notes: body.notes || null,
      startedAt: body.startedAt ? new Date(body.startedAt) : null,
      completedAt: body.completedAt ? new Date(body.completedAt) : null,
      testedBy: user.id,
    },
    include: {
      equipment: { select: { id: true, hostname: true, ipAddress: true } },
    },
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const fields = [
    "workloadName", "workloadConfig", "cycleDuration", "result",
    "value", "unit", "notes",
  ];
  for (const f of fields) {
    if (f in body) data[f] = body[f];
  }
  if ("totalCycles" in body) data.totalCycles = body.totalCycles ? parseInt(body.totalCycles) : null;
  if ("completedCycles" in body) data.completedCycles = body.completedCycles ? parseInt(body.completedCycles) : null;
  if ("startedAt" in body) data.startedAt = body.startedAt ? new Date(body.startedAt) : null;
  if ("completedAt" in body) data.completedAt = body.completedAt ? new Date(body.completedAt) : null;

  const result = await prisma.evalResult.update({
    where: { id: body.resultId },
    data,
    include: {
      equipment: { select: { id: true, hostname: true, ipAddress: true } },
    },
  });

  return NextResponse.json(result);
}
