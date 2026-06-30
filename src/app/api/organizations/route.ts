import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";

const CreateOrgSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
});

/** GET /api/organizations — list all organizations (ADMIN only) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: { members: true, equipment: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items: orgs });
}

/** POST /api/organizations — create organization (ADMIN only) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, CreateOrgSchema);
  if (parsed.response) return parsed.response;
  const { name, description } = parsed.data;

  // Check duplicate name
  const existing = await prisma.organization.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "Organization with this name already exists" },
      { status: 409 },
    );
  }

  const org = await prisma.organization.create({
    data: {
      name,
      description: description ?? null,
    },
    include: {
      _count: { select: { members: true, equipment: true } },
    },
  });

  return NextResponse.json(org, { status: 201 });
}
