import { NextRequest, NextResponse } from "next/server";
import { runExpiryCheck } from "@/lib/expiry-check";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint for automated expiry checking.
 *
 * Auth: requires CRON_SECRET via Authorization: Bearer header. No user session
 * is needed so an external scheduler can call it. The secret must NOT be passed
 * in the URL (leaks into access logs).
 *
 * Setup (docker host crontab, daily 08:00):
 *   0 8 * * * curl -fsS -H "Authorization: Bearer THE_SECRET" \
 *     http://10.144.38.100:3000/api/cron/expiry-check >/dev/null
 *
 * If CRON_SECRET is not set, the endpoint is disabled (503) to avoid an
 * unauthenticated trigger in production.
 */
async function handle(req: NextRequest) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const result = await runExpiryCheck();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
