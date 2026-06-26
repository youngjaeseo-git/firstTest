import { NextRequest, NextResponse } from "next/server";
import { runAlertCheck } from "@/lib/alert-check";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint for alert rule evaluation.
 *
 * Queries Prometheus for each enabled AlertRule and creates/resolves Alerts.
 *
 * Auth: requires CRON_SECRET (same as expiry-check).
 *
 * Setup (docker host crontab, every 5 minutes):
 *   *​/5 * * * * curl -fsS -H "Authorization: Bearer THE_SECRET" \
 *     http://10.144.38.100:3000/api/cron/alert-check >/dev/null
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

  const result = await runAlertCheck();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
