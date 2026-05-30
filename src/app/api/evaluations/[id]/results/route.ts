import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { CreateResultSchema, UpdateResultSchema } from "@/lib/schemas/evaluation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, CreateResultSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const result = await prisma.evalResult.create({
    data: {
      projectId: id,
      phaseId: d.phaseId ?? null,
      equipmentId: d.equipmentId ?? null,
      workloadName: d.workloadName,
      workloadConfig: d.workloadConfig ?? null,
      cycleDuration: d.cycleDuration ?? null,
      totalCycles: d.totalCycles ?? null,
      completedCycles: d.completedCycles ?? null,
      result: d.result ?? "PENDING",
      value: d.value ?? null,
      unit: d.unit ?? null,
      notes: d.notes ?? null,
      startedAt: d.startedAt ?? null,
      completedAt: d.completedAt ?? null,
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

  const parsed = await parseBody(req, UpdateResultSchema);
  if (parsed.response) return parsed.response;
  const { resultId, ...data } = parsed.data;

  const result = await prisma.evalResult.update({
    where: { id: resultId },
    data,
    include: {
      equipment: { select: { id: true, hostname: true, ipAddress: true } },
    },
  });

  return NextResponse.json(result);
}
