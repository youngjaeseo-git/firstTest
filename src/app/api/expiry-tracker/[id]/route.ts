import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z
    .enum([
      "K8S_CERTIFICATE",
      "TLS_CERTIFICATE",
      "LICENSE",
      "WARRANTY",
      "DOMAIN",
      "CUSTOM",
    ])
    .optional(),
  description: z.string().max(500).nullable().optional(),
  expiresAt: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date")
    .optional(),
  notifyDays: z.number().int().min(1).max(365).optional(),
  source: z.string().max(200).nullable().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "RENEWED", "DISMISSED"]).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = await parseBody(req, UpdateSchema);
  if (parsed.response) return parsed.response;

  const { metadata, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (data.expiresAt) data.expiresAt = new Date(data.expiresAt as string);
  if (metadata !== undefined) data.metadata = metadata ?? undefined;

  const item = await prisma.expiryTracker.update({
    where: { id },
    data,
  });

  // When an item is renewed or dismissed, auto-resolve any open alert it raised
  // so stale expiry alerts don't linger.
  if (rest.status === "RENEWED" || rest.status === "DISMISSED") {
    await prisma.alert.updateMany({
      where: { source: `expiry:${id}`, status: { in: ["FIRING", "ACKNOWLEDGED"] } },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.expiryTracker.delete({ where: { id } });

  // Resolve any open alert raised by this item.
  await prisma.alert.updateMany({
    where: { source: `expiry:${id}`, status: { in: ["FIRING", "ACKNOWLEDGED"] } },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
