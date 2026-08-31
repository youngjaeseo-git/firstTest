import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum([
    "K8S_CERTIFICATE",
    "TLS_CERTIFICATE",
    "LICENSE",
    "WARRANTY",
    "DOMAIN",
    "CUSTOM",
  ]),
  description: z.string().max(500).nullable().optional(),
  expiresAt: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  notifyDays: z.number().int().min(1).max(365).optional().default(30),
  source: z.string().max(200).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.expiryTracker.findMany({
    where: { status: { not: "DISMISSED" } },
    orderBy: { expiresAt: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, CreateSchema);
  if (parsed.response) return parsed.response;

  const { metadata, ...rest } = parsed.data;
  const item = await prisma.expiryTracker.create({
    data: {
      ...rest,
      expiresAt: new Date(rest.expiresAt),
      createdBy: user.id,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
