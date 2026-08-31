import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { runExpiryCheck } from "@/lib/expiry-check";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runExpiryCheck();
  return NextResponse.json(result);
}
