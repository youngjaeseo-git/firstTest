import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { StepConfigSchema } from "@/lib/schemas/evaluation";

export const dynamic = "force-dynamic";

const CreateEvalSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  evalType: z.enum(["FIELD", "ACCELERATED"]),
  namespace: z.string().trim().max(200).optional().nullable(),
  memoryType: z.enum(["DDR3", "DDR4", "DDR5", "HBM", "HBM2", "HBM2E", "HBM3", "LPDDR4", "LPDDR5"]).optional().nullable(),
  manufacturer: z.string().trim().max(100).optional().nullable(),
  partNumber: z.string().trim().max(200).optional().nullable(),
  capacityGb: z.coerce.number().min(0).max(65536).optional().nullable(),
  speedMhz: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  formFactor: z.string().trim().max(50).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  assigneeId: z.string().trim().max(50).optional().nullable(),
  phases: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional().nullable(),
        config: StepConfigSchema,
      }),
    )
    .max(50)
    .optional(),
});

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const parsed = await parseBody(req, CreateEvalSchema);
  if (parsed.response) return parsed.response;
  const {
    title, description, evalType, namespace: bodyNamespace, memoryType, manufacturer,
    partNumber, capacityGb, speedMhz, formFactor,
    startDate, endDate, assigneeId, phases,
  } = parsed.data;

  const project = await prisma.evalProject.create({
    data: {
      title,
      description: description || null,
      evalType,
      namespace: bodyNamespace || null,
      memoryType: memoryType || null,
      manufacturer: manufacturer || null,
      partNumber: partNumber || null,
      capacityGb: capacityGb ?? null,
      speedMhz: speedMhz ?? null,
      formFactor: formFactor || null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      createdBy: user.id,
      assigneeId: assigneeId || null,
      ...(phases && phases.length > 0
        ? {
            phases: {
              create: phases.map((p, i) => ({
                name: p.name,
                description: p.description || null,
                sortOrder: i,
                config: p.config ? (p.config as Prisma.InputJsonValue) : undefined,
              })),
            },
          }
        : {}),
    },
    include: { phases: true },
  });

  return NextResponse.json(project, { status: 201 });
}
