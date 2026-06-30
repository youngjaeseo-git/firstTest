import { NextResponse } from "next/server";
import { instantQuery } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

/**
 * Lightweight Prometheus liveness probe used by the header indicator.
 * Issues a trivial `up` query and reports the outcome.
 */
export async function GET() {
  try {
    const result = await instantQuery("up");
    const nodeCount = result.data?.result?.length ?? 0;
    return NextResponse.json({ status: "ok", nodeCount });
  } catch {
    return NextResponse.json(
      { status: "unreachable", nodeCount: 0 },
      { status: 200 },
    );
  }
}
