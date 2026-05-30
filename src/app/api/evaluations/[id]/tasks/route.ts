import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { readJsonObject } from "@/lib/api-validation";

export async function POST(
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
  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const task = await prisma.evalTask.create({
    data: {
      projectId: id,
      phaseId: (body.phaseId as string) || null,
      title: body.title as string,
      description: (body.description as string) || null,
      priority: ((body.priority as string) || "MEDIUM") as import("@prisma/client").EvalTaskPriority,
      assigneeId: (body.assigneeId as string) || null,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : null,
      createdBy: user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (!body.taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = body.title;
  if ("description" in body) data.description = body.description;
  if ("status" in body) {
    data.status = body.status;
    if (body.status === "DONE") data.completedAt = new Date();
    else data.completedAt = null;
  }
  if ("priority" in body) data.priority = body.priority;
  if ("assigneeId" in body) data.assigneeId = body.assigneeId || null;
  if ("dueDate" in body) data.dueDate = body.dueDate ? new Date(body.dueDate as string) : null;

  const task = await prisma.evalTask.update({
    where: { id: body.taskId as string },
    data,
  });

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const taskId = searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  await prisma.evalTask.delete({ where: { id: taskId } });
  return NextResponse.json({ success: true });
}
