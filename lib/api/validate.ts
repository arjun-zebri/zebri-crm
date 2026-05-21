/**
 * API input-validation helpers.
 *
 * Wraps Zod parsing in result-typed helpers so route handlers never
 * have to write the same `try { JSON.parse } catch → 400` boilerplate
 * over and over. Use `parseJsonBody` for POST/PUT/PATCH payloads and
 * `parseSearchParams` for query strings.
 *
 * Phase 0.8a ships the infrastructure; per-route adoption happens
 * during each surface's hardening (the per-page Definition of Done
 * mandates Zod validation at every API boundary).
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { parseJsonBody } from '@/lib/api/validate';
 *
 * const Body = z.object({
 *   coupleId: z.uuid(),
 *   amount: z.number().int().positive(),
 * });
 *
 * export async function POST(request: Request) {
 *   const parsed = await parseJsonBody(request, Body);
 *   if (!parsed.ok) return parsed.response; // 400 with sanitised issues
 *   const { coupleId, amount } = parsed.data;
 *   // …
 * }
 * ```
 *
 * @module lib/api/validate
 */
import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

export interface ParseSuccess<T> {
  ok: true;
  data: T;
}
export interface ParseFailure {
  ok: false;
  response: NextResponse;
}
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/**
 * Build a 400 response from a ZodError. The `issues` list is sanitised
 * to only `{ path, code, message }` — never the offending value (which
 * could contain PII the client already knows about, but logging it
 * back is unnecessary).
 */
function badRequest(error: z.ZodError, label: string): NextResponse {
  return NextResponse.json(
    {
      error: `Invalid ${label}`,
      issues: error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    },
    { status: 400 },
  );
}

/** Parse & validate a JSON request body. Returns a tagged result. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: badRequest(parsed.error, 'request body') };
  return { ok: true, data: parsed.data };
}

/** Parse & validate URL search params (`?a=1&b=foo`). */
export function parseSearchParams<T>(
  request: Request,
  schema: ZodType<T>,
): ParseResult<T> {
  const params: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) params[k] = v;
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, response: badRequest(parsed.error, 'query parameters') };
  return { ok: true, data: parsed.data };
}
