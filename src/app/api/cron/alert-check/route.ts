import { NextRequest, NextResponse } from "next/server";
import { runAlertCheck } from "@/lib/alert-check";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint for alert rule evaluation.
 *
 * Queries Prometheus for each enabled AlertRule and creates/resolves Alerts.
 *
 * Auth: requires CRON_SECRET via Authorization: Bearer header (same as
 * expiry-check). The secret must NOT be passed in the URL.
 *
 * Setup (docker host crontab, every 5 minutes):
 *   *​/5 * * * * curl -fsS -H "Authorization: Bearer THE_SECRET" \
 *     http://10.144.38.100:3000/api/cron/alert-check >/dev/null
 */
async function handle(req: NextRequest) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const result = await runAlertCheck();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
