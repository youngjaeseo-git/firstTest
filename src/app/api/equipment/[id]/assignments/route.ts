import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const CreateAssignmentSchema = z.object({
  assignedTo: z.string().trim().min(1).max(100),
  purpose: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const ReleaseAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await prisma.equipmentAssignment.findMany({
    where: { equipmentId: id },
    orderBy: [{ releasedAt: "asc" }, { assignedAt: "desc" }],
  });

  const active = assignments.filter((a) => !a.releasedAt);
  const history = assignments.filter((a) => !!a.releasedAt);

  return NextResponse.json({ active, history });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, CreateAssignmentSchema);
  if (parsed.response) return parsed.response;

  const equipment = await prisma.equipment.findUnique({ where: { id } });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assignment = await prisma.equipmentAssignment.create({
    data: {
      equipmentId: id,
      assignedTo: parsed.data.assignedTo,
      purpose: parsed.data.purpose || null,
      notes: parsed.data.notes || null,
      createdBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "EquipmentAssignment",
    entityId: assignment.id,
    changes: {
      equipmentId: id,
      assignedTo: parsed.data.assignedTo,
      purpose: parsed.data.purpose || null,
    },
  });

  return NextResponse.json(assignment, { status: 201 });
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

  const parsed = await parseBody(req, ReleaseAssignmentSchema);
  if (parsed.response) return parsed.response;

  const assignment = await prisma.equipmentAssignment.findFirst({
    where: {
      id: parsed.data.assignmentId,
      equipmentId: id,
      releasedAt: null,
    },
  });

  if (!assignment) {
    return NextResponse.json(
      { error: "Active assignment not found" },
      { status: 404 },
    );
  }

  const updated = await prisma.equipmentAssignment.update({
    where: { id: assignment.id },
    data: {
      releasedAt: new Date(),
      notes: parsed.data.notes ?? assignment.notes,
    },
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "EquipmentAssignment",
    entityId: assignment.id,
    changes: {
      action: "release",
      assignedTo: assignment.assignedTo,
      equipmentId: id,
    },
  });

  return NextResponse.json(updated);
}
