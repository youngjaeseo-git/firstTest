import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Shared auth guard for cron endpoints (/api/cron/*).
 *
 * These routes are excluded from the session middleware because an external
 * scheduler (host crontab) calls them without a user session. They are instead
 * protected by CRON_SECRET.
 *
 * Hardening:
 *  - Bearer header ONLY. The secret must never travel in the URL (?key=…),
 *    which would leak it into access logs, proxies and browser history.
 *  - Constant-time comparison (timingSafeEqual) to avoid leaking the secret
 *    byte-by-byte through response-timing analysis.
 *
 * Returns a NextResponse to short-circuit on failure, or null when authorized.
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/** Constant-time string comparison; false on any length/encoding mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
