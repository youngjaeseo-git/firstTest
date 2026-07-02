import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { CreateTaskSchema, UpdateTaskSchema } from "@/lib/schemas/evaluation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
  }

  const parsed = await parseBody(req, CreateTaskSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const task = await prisma.evalTask.create({
    data: {
      projectId: id,
      phaseId: d.phaseId ?? null,
      title: d.title,
      description: d.description ?? null,
      priority: d.priority ?? "MEDIUM",
      assigneeId: d.assigneeId ?? null,
      dueDate: d.dueDate ?? null,
      createdBy: user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
  }

  const parsed = await parseBody(req, UpdateTaskSchema);
  if (parsed.response) return parsed.response;
  const { taskId, status, ...rest } = parsed.data;

  const data: Record<string, unknown> = { ...rest };
  if (status !== undefined) {
    data.status = status;
    data.completedAt = status === "DONE" ? new Date() : null;
  }

  const task = await prisma.evalTask.update({
    where: { id: taskId },
    data,
  });

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const taskId = searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  await prisma.evalTask.delete({ where: { id: taskId } });
  return NextResponse.json({ success: true });
}
