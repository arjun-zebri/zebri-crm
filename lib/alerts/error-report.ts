/**
 * Pure helpers shared by the two error-alert paths: the browser report
 * (`/api/alerts/client-error`) and the server logger transport
 * (`./server-error-transport`).
 *
 * Kept free of I/O and React so both the client bundle and the server can
 * import it, and so every rule here is unit-testable on its own.
 *
 * @module lib/alerts/error-report
 */

import { z } from 'zod';

/**
 * What the browser sends when something fails in front of an MC.
 *
 * Only facts the browser alone knows. Who is signed in, which build is
 * live and which browser it is are added on the server, where they cannot
 * be spoofed into the alert.
 */
export const clientErrorReportSchema = z.object({
  /** `mutation`: a save/delete failed. `render`: a page crashed. `crash`: the root layout crashed. */
  kind: z.enum(['mutation', 'render', 'crash']),
  message: z.string().trim().min(1).max(500),
  code: z.string().trim().max(60).optional(),
  /** Next.js error digest, which matches the server log line for a server render error. */
  digest: z.string().trim().max(100).optional(),
  /** The mutation's `mutationKey`, when it set one. */
  mutation: z.string().trim().max(120).optional(),
  /** `pathname + search` at the time of the failure. Redacted server-side. */
  page: z.string().max(500),
});

/** A validated browser error report. */
export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;

/** The message and code of whatever was thrown, without trusting its shape. */
export interface ErrorFields {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
}

/** Read a string property off an unknown value, if it has one. */
function stringProp(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined;
  const prop = (value as Record<string, unknown>)[key];
  if (typeof prop === 'string' && prop.length > 0) return prop;
  if (typeof prop === 'number') return String(prop);
  return undefined;
}

/**
 * Pull a readable message (plus Postgres `code` / `details` / `hint`,
 * when present) out of anything that was thrown or logged.
 *
 * Supabase hands back plain `PostgrestError` objects, not `Error`s, so an
 * `instanceof Error` check alone would reduce the most useful failures
 * (constraint violations, RLS denials) to "[object Object]".
 */
export function errorFields(error: unknown): ErrorFields {
  if (typeof error === 'string') return { message: error };
  const message =
    stringProp(error, 'message') ??
    (error === undefined || error === null ? '(no error object)' : safeJson(error));
  const fields: ErrorFields = { message };
  const code = stringProp(error, 'code');
  const detail = stringProp(error, 'details') ?? stringProp(error, 'detail');
  const hint = stringProp(error, 'hint');
  if (code) fields.code = code;
  if (detail) fields.detail = detail;
  if (hint) fields.hint = hint;
  return fields;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Long opaque path segments and query values are capability tokens on the
 * public surfaces (`/invoice/<token>`, `/portal/<token>`), and a token in
 * Slack is a working link to a couple's documents. Twenty characters
 * clears every real route word (`questionnaires` is 14) while catching
 * UUIDs and random tokens. The first six characters stay so two alerts
 * about the same record can still be matched up.
 */
const OPAQUE_RE = /^[A-Za-z0-9_-]{20,}$/;

function redactValue(value: string): string {
  if (value.includes('@')) return '[redacted]';
  return OPAQUE_RE.test(value) ? `${value.slice(0, 6)}…` : value;
}

/**
 * Make a `pathname + search` safe to post: tokens shortened, anything
 * email-shaped dropped. `/couples?view=board` passes through untouched.
 */
export function redactPage(page: string): string {
  const [path = '', query] = page.split('?', 2);
  const safePath = path
    .split('/')
    .map((segment) => redactValue(decodeSafe(segment)))
    .join('/');
  if (!query) return safePath || '/';
  const params = new URLSearchParams(query);
  const safe = new URLSearchParams();
  params.forEach((value, key) => safe.append(key, redactValue(value)));
  const qs = safe.toString();
  return `${safePath || '/'}${qs ? `?${decodeURIComponent(qs)}` : ''}`;
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * "Chrome 154 · Windows" from a user-agent string. Coarse on purpose: it
 * is there to spot "only Safari users hit this", not to fingerprint.
 * Order matters: Edge and Chrome on iOS both also claim Safari, and Edge
 * also claims Chrome.
 */
export function describeBrowser(userAgent: string | null): string {
  if (!userAgent) return 'unknown browser';
  const ua = userAgent;
  const browser =
    match(ua, /Edg(?:e|A|iOS)?\/(\d+)/, 'Edge') ??
    match(ua, /CriOS\/(\d+)/, 'Chrome') ??
    match(ua, /FxiOS\/(\d+)/, 'Firefox') ??
    match(ua, /Firefox\/(\d+)/, 'Firefox') ??
    match(ua, /Chrome\/(\d+)/, 'Chrome') ??
    match(ua, /Version\/(\d+)[\d.]* .*Safari\//, 'Safari') ??
    'Other browser';
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'other OS';
  return `${browser} · ${os}`;
}

function match(ua: string, re: RegExp, name: string): string | undefined {
  const m = re.exec(ua);
  return m ? `${name} ${m[1]}` : undefined;
}

/** Short commit of the running deployment plus its environment, e.g. "b0c5991 · production". */
export function describeBuild(env: NodeJS.ProcessEnv = process.env): string {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
  const where = env.VERCEL_ENV ?? env.NODE_ENV ?? 'unknown';
  return `${sha} · ${where}`;
}

/**
 * Wall-clock time in Sydney with its zone, e.g. "2 Oct 2026, 2:24:35 pm AEST".
 * The old alerts used the browser's own zone with no label, so a time
 * from an MC in Perth read three hours wrong.
 */
export function sydneyTime(at: Date = new Date()): string {
  return at.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
