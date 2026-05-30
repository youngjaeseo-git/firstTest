import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { parseBody } from "@/lib/api-validation";

const SignupSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email("유효한 이메일 형식이 아닙니다.").max(255),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다.").max(200),
});

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, SignupSchema);
  if (parsed.response) return parsed.response;
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 존재하는 이메일입니다." },
      { status: 409 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: hashedPassword,
      role: "VIEWER",
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
