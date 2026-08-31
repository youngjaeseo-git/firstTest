import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Parses and validates a request body against a Zod schema.
 *
 * Returns either `{ data }` on success or `{ response }` containing a ready-to-return
 * 400 NextResponse on failure (malformed JSON or schema validation error). This keeps
 * the per-route boilerplate to a single guard:
 *
 *   const parsed = await parseBody(req, Schema);
 *   if (parsed.response) return parsed.response;
 *   const { field } = parsed.data;
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response?: never } | { data?: never; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      response: NextResponse.json(
        { error: "Invalid request", details: result.error.errors },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}

/**
 * Safely reads a JSON object body without a schema. Use for routes that already
 * do their own field whitelisting; this only guards against malformed-JSON crashes.
 */
export async function readJsonObject(
  req: Request,
): Promise<
  | { body: Record<string, unknown>; response?: never }
  | { body?: never; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      response: NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      ),
    };
  }
  return { body: raw as Record<string, unknown> };
}

/** Quotes and escapes a single CSV field so embedded commas/quotes/newlines are safe. */
export function escapeCsv(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Parses a date query param, returning undefined if absent and throwing on invalid input. */
export function parseDateParam(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${value}`);
  }
  return date;
}
