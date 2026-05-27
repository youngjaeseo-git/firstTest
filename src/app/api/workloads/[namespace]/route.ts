import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ns = decodeURIComponent(params.namespace);
  const body = await req.json();
  const { title, description, evalType } = body;

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
