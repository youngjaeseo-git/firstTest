import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { readJsonObject } from "@/lib/api-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (!body.workloadName) {
    return NextResponse.json({ error: "workloadName required" }, { status: 400 });
  }

  const result = await prisma.evalResult.create({
    data: {
      projectId: id,
      phaseId: (body.phaseId as string) || null,
      equipmentId: (body.equipmentId as string) || null,
      workloadName: body.workloadName as string,
      workloadConfig: (body.workloadConfig as string) || null,
      cycleDuration: (body.cycleDuration as string) || null,
      totalCycles: body.totalCycles ? parseInt(body.totalCycles as string) : null,
      completedCycles: body.completedCycles ? parseInt(body.completedCycles as string) : null,
      result: ((body.result as string) || "PENDING") as import("@prisma/client").EvalTestResult,
      value: (body.value as string) || null,
      unit: (body.unit as string) || null,
      notes: (body.notes as string) || null,
      startedAt: body.startedAt ? new Date(body.startedAt as string) : null,
      completedAt: body.completedAt ? new Date(body.completedAt as string) : null,
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

  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
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
  if ("totalCycles" in body) data.totalCycles = body.totalCycles ? parseInt(body.totalCycles as string) : null;
  if ("completedCycles" in body) data.completedCycles = body.completedCycles ? parseInt(body.completedCycles as string) : null;
  if ("startedAt" in body) data.startedAt = body.startedAt ? new Date(body.startedAt as string) : null;
  if ("completedAt" in body) data.completedAt = body.completedAt ? new Date(body.completedAt as string) : null;

  const result = await prisma.evalResult.update({
    where: { id: body.resultId as string },
    data,
    include: {
      equipment: { select: { id: true, hostname: true, ipAddress: true } },
    },
  });

  return NextResponse.json(result);
}
