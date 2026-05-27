import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const evalType = searchParams.get("evalType");
  const namespace = searchParams.get("namespace");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (evalType) where.evalType = evalType;
  if (namespace) where.namespace = namespace;

  const projects = await prisma.evalProject.findMany({
    where,
    include: {
      phases: { orderBy: { sortOrder: "asc" } },
      _count: { select: { results: true, tasks: true, notes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items: projects });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    title, description, evalType, namespace: bodyNamespace, memoryType, manufacturer,
    partNumber, capacityGb, speedMhz, formFactor,
    startDate, endDate, assigneeId, phases,
  } = body;

  if (!title || !evalType) {
    return NextResponse.json({ error: "title and evalType are required" }, { status: 400 });
  }

  const project = await prisma.evalProject.create({
    data: {
      title,
      description,
      evalType,
      namespace: bodyNamespace || null,
      memoryType: memoryType || null,
      manufacturer: manufacturer || null,
      partNumber: partNumber || null,
      capacityGb: capacityGb ? parseFloat(capacityGb) : null,
      speedMhz: speedMhz ? parseInt(speedMhz) : null,
      formFactor: formFactor || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: user.id,
      assigneeId: assigneeId || null,
      ...(phases && phases.length > 0
        ? {
            phases: {
              create: phases.map((p: { name: string; description?: string }, i: number) => ({
                name: p.name,
                description: p.description || null,
                sortOrder: i,
              })),
            },
          }
        : {}),
    },
    include: { phases: true },
  });

  return NextResponse.json(project, { status: 201 });
}
