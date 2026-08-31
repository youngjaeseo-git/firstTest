import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { CreateResultSchema, UpdateResultSchema } from "@/lib/schemas/evaluation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
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
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
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

export async function DELETE(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const resultId = searchParams.get("resultId");
  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }

  await prisma.evalResult.delete({ where: { id: resultId } });
  return NextResponse.json({ success: true });
}
