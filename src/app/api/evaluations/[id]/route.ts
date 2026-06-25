import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { UpdateProjectSchema } from "@/lib/schemas/evaluation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = await prisma.evalProject.findUnique({
    where: { id },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          results: {
            include: { equipment: { select: { id: true, hostname: true, ipAddress: true } } },
            orderBy: { createdAt: "desc" },
          },
          tasks: { orderBy: { createdAt: "asc" } },
        },
      },
      results: {
        include: { equipment: { select: { id: true, hostname: true, ipAddress: true } } },
        orderBy: { createdAt: "desc" },
      },
      tasks: { orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }] },
      notes: { orderBy: { createdAt: "desc" } },
      _count: { select: { results: true, tasks: true, notes: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, UpdateProjectSchema);
  if (parsed.response) return parsed.response;

  const project = await prisma.evalProject.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.evalProject.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete evaluation project:", error);
    return NextResponse.json(
      { error: "Failed to delete evaluation project" },
      { status: 500 },
    );
  }
}
