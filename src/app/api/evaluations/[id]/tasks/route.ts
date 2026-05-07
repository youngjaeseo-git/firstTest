import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const task = await prisma.evalTask.create({
    data: {
      projectId: id,
      phaseId: body.phaseId || null,
      title: body.title,
      description: body.description || null,
      priority: body.priority || "MEDIUM",
      assigneeId: body.assigneeId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
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

  const body = await req.json();
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
  if ("dueDate" in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const task = await prisma.evalTask.update({
    where: { id: body.taskId },
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
