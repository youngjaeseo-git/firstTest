import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";

const AddMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]).optional(),
});

/** GET /api/organizations/[id]/members — list members (ADMIN only) */
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
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const members = await prisma.userOrganization.findMany({
    where: { organizationId: id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({ items: members });
}

/** POST /api/organizations/[id]/members — add member (ADMIN only) */
export async function POST(
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
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const parsed = await parseBody(req, AddMemberSchema);
  if (parsed.response) return parsed.response;
  const { userId, role } = parsed.data;

  // Verify user exists
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already a member
  const existing = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId: id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already a member of this organization" },
      { status: 409 },
    );
  }

  const membership = await prisma.userOrganization.create({
    data: {
      userId,
      organizationId: id,
      role: role ?? "VIEWER",
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(membership, { status: 201 });
}

/** DELETE /api/organizations/[id]/members?userId=xxx — remove member (ADMIN only) */
export async function DELETE(
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
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required" },
      { status: 400 },
    );
  }

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId: id } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Membership not found" },
      { status: 404 },
    );
  }

  await prisma.userOrganization.delete({
    where: { userId_organizationId: { userId, organizationId: id } },
  });

  return NextResponse.json({ success: true });
}
