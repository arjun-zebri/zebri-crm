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
 * Server-action friendly version of {@link ParseSuccess}/{@link ParseFailure}.
 *
 * Server actions return values to client components rendering the
 * form (typically via React's `useActionState`), not HTTP responses
 * — so a Zod failure has to come back as a tagged value that the
 * page can show inline. `error` is the headline; `fieldErrors` maps
 * each invalid field path to its first issue message so the form
 * can place the error next to the relevant input.
 */
export interface FormParseSuccess<T> {
  ok: true;
  data: T;
}
export interface FormParseFailure {
  ok: false;
  error: string;
  fieldErrors: Record<string, string>;
}
export type FormParseResult<T> = FormParseSuccess<T> | FormParseFailure;

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

/**
 * Parse & validate a `FormData` payload (server-action calling
 * convention). Returns a tagged result the form can render inline.
 *
 * Empty-string values are coerced to `undefined` so optional Zod
 * fields don't trip on the empty HTML default. Multi-value fields
 * (`<select multiple>` etc.) keep their array shape.
 */
export function parseFormData<T>(
  formData: FormData,
  schema: ZodType<T>,
): FormParseResult<T> {
  const raw: Record<string, FormDataEntryValue | FormDataEntryValue[] | undefined> = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key);
    if (all.length === 0) raw[key] = undefined;
    else if (all.length === 1) {
      const v = all[0];
      raw[key] = typeof v === 'string' && v === '' ? undefined : v;
    } else raw[key] = all;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_';
    if (!fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return {
    ok: false,
    error: parsed.error.issues[0]?.message ?? 'Invalid input',
    fieldErrors,
  };
}
