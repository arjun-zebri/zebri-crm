/**
 * The public lead API's error envelope. Every non-200 body is
 * `{ error: <code>, message, ...extra }` so a third-party form can branch on
 * `error` and show `fields` under its inputs. Messages never echo submitted
 * values.
 *
 * @module lib/lead-capture/api-responses
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';

/** Stable machine-readable error codes. Documented in api-reference.ts. */
export type LeadApiErrorCode =
  | 'validation_failed'
  | 'origin_not_allowed'
  | 'form_not_found'
  | 'form_disabled'
  | 'rate_limited'
  | 'server_error';

/** Build an error response in the contract shape. */
export function leadApiError(
  status: number,
  error: LeadApiErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json({ error, message, ...extra }, { status, headers });
}

/**
 * Zod issues to a `{ 'payload.key': message }` map. The first message per path
 * wins; paths join with dots so `custom[0].label` reads `custom.0.label`.
 */
export function zodIssuesToFields(issues: z.ZodError['issues']): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Set headers on an already-built response (used to add CORS after the origin check). */
export function withHeaders(res: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}
