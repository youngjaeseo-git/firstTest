import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { CreatePhaseSchema, UpdatePhaseSchema } from "@/lib/schemas/evaluation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, CreatePhaseSchema);
  if (parsed.response) return parsed.response;
  const { name, description, startDate, endDate } = parsed.data;

  const maxOrder = await prisma.evalPhase.aggregate({
    where: { projectId: id },
    _max: { sortOrder: true },
  });

  const phase = await prisma.evalPhase.create({
    data: {
      projectId: id,
      name,
      description: description ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    },
  });

  return NextResponse.json(phase, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, UpdatePhaseSchema);
  if (parsed.response) return parsed.response;
  const { phaseId, ...data } = parsed.data;

  const phase = await prisma.evalPhase.update({
    where: { id: phaseId },
    data,
  });

  return NextResponse.json(phase);
}
