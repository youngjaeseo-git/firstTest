import { NextRequest, NextResponse } from "next/server";
import { runExpiryCheck } from "@/lib/expiry-check";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint for automated expiry checking.
 *
 * Auth: requires the CRON_SECRET to be supplied either as
 *   - Authorization: Bearer THE_SECRET   (recommended)
 *   - or ?key=THE_SECRET
 * No user session is needed so an external scheduler can call it.
 *
 * Setup (docker host crontab, daily 08:00):
 *   0 8 * * * curl -fsS -H "Authorization: Bearer THE_SECRET" \
 *     http://10.144.38.100:3000/api/cron/expiry-check >/dev/null
 *
 * If CRON_SECRET is not set, the endpoint is disabled (503) to avoid an
 * unauthenticated trigger in production.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const keyParam = req.nextUrl.searchParams.get("key");
  const provided = bearer || keyParam;

  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runExpiryCheck();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
