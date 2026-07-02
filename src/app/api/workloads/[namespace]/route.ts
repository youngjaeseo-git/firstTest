import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";

const CreateWorkloadEvalSchema = z.object({
  title: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  evalType: z.enum(["FIELD", "ACCELERATED"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { namespace: string } },
) {
  const ns = decodeURIComponent(params.namespace);

  const projects = await prisma.evalProject.findMany({
    where: { namespace: ns },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        include: { results: true, tasks: true },
      },
      results: { include: { equipment: true } },
      tasks: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      _count: { select: { results: true, tasks: true, notes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const active = projects.filter(
    (p) => p.status !== "COMPLETED" && p.status !== "CANCELLED",
  );
  const history = projects.filter(
    (p) => p.status === "COMPLETED" || p.status === "CANCELLED",
  );

  return NextResponse.json({ namespace: ns, active, history });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { namespace: string } },
) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
  }

  const ns = decodeURIComponent(params.namespace);
  const parsed = await parseBody(req, CreateWorkloadEvalSchema);
  if (parsed.response) return parsed.response;
  const { title, description, evalType } = parsed.data;

  const project = await prisma.evalProject.create({
    data: {
      title: title || `${ns} Evaluation`,
      description: description || null,
      evalType: evalType || "FIELD",
      namespace: ns,
      status: "IN_PROGRESS",
      startDate: new Date(),
      createdBy: user.id,
    },
    include: { phases: true },
  });

  return NextResponse.json(project, { status: 201 });
}
