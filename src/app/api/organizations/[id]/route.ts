import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";

const UpdateOrgSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
});

/** GET /api/organizations/[id] — single organization with members and equipment count (ADMIN only) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { equipment: true } },
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(org);
}

/** PATCH /api/organizations/[id] — update organization (ADMIN only) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = await parseBody(req, UpdateOrgSchema);
  if (parsed.response) return parsed.response;
  const { name, description } = parsed.data;

  // If renaming, check uniqueness
  if (name && name !== existing.name) {
    const duplicate = await prisma.organization.findUnique({ where: { name } });
    if (duplicate) {
      return NextResponse.json(
        { error: "Organization with this name already exists" },
        { status: 409 },
      );
    }
  }

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description: description ?? null } : {}),
    },
    include: {
      _count: { select: { members: true, equipment: true } },
    },
  });

  return NextResponse.json(org);
}

/** DELETE /api/organizations/[id] — delete organization (ADMIN only, only if no equipment) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { equipment: true } } },
  });

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (org._count.equipment > 0) {
    return NextResponse.json(
      { error: "Cannot delete organization with assigned equipment. Reassign or remove equipment first." },
      { status: 409 },
    );
  }

  await prisma.organization.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
