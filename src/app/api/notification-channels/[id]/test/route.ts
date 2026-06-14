export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Best-effort delivery test for a notification channel.
 * SLACK/TEAMS/WEBHOOK post a JSON payload to the target URL.
 * EMAIL has no SMTP transport wired yet, so it reports "not configured".
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channel = await prisma.notificationChannel.findUnique({ where: { id } });
  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const text = `DC Express test notification — channel "${channel.name}" is working.`;

  if (channel.type === "EMAIL") {
    return NextResponse.json({
      ok: false,
      message: "Email transport (SMTP) is not configured on this deployment yet.",
    });
  }

  // Slack and Teams both accept a simple { text } webhook payload.
  const payload =
    channel.type === "TEAMS" ? { text } : { text };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(channel.target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        message: `Endpoint responded with HTTP ${res.status}.`,
      });
    }
    return NextResponse.json({ ok: true, message: "Test notification sent." });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message:
        err instanceof Error && err.name === "AbortError"
          ? "Request timed out (5s). The endpoint may be unreachable from this network."
          : "Could not reach the endpoint. Check the URL and network access.",
    });
  }
}
