import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";

const NoteSchema = z.object({
  content: z.string().trim().min(1, "content required").max(5000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, NoteSchema);
  if (parsed.response) return parsed.response;

  const note = await prisma.evalNote.create({
    data: {
      projectId: id,
      content: parsed.data.content,
      createdBy: user.id,
    },
  });

  return NextResponse.json(note, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const noteId = searchParams.get("noteId");
  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  await prisma.evalNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
