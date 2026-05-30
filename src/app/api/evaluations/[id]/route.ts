import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { readJsonObject } from "@/lib/api-validation";

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

  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const allowed = [
    "title", "description", "evalType", "status", "memoryType",
    "manufacturer", "partNumber", "capacityGb", "speedMhz",
    "formFactor", "startDate", "endDate", "assigneeId",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "startDate" || key === "endDate") {
        data[key] = body[key] ? new Date(body[key] as string) : null;
      } else if (key === "capacityGb") {
        data[key] = body[key] ? parseFloat(body[key] as string) : null;
      } else if (key === "speedMhz") {
        data[key] = body[key] ? parseInt(body[key] as string) : null;
      } else {
        data[key] = body[key] || null;
      }
    }
  }

  const project = await prisma.evalProject.update({
    where: { id },
    data,
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

  await prisma.evalProject.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
