/**
 * Browser-side sender for `/api/alerts/client-error`.
 *
 * Used by the mutation cache (`app/providers.tsx`) and the two error
 * boundaries. Fire-and-forget: reporting a failure must never cause one.
 *
 * @module lib/alerts/report-client-error
 */

import { errorFields, type ClientErrorReport } from './error-report';

/** What a call site supplies; the page is read here. */
export type ClientErrorInput = Omit<ClientErrorReport, 'page' | 'message' | 'code'> & {
  error: unknown;
};

/** Truncate to the schema's limit so a long message is cut, not rejected. */
function clip(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Post one error report. No-op outside the browser. Never throws. */
export function reportClientError({ error, kind, digest, mutation }: ClientErrorInput): void {
  if (typeof window === 'undefined') return;
  const fields = errorFields(error);
  const body: ClientErrorReport = {
    kind,
    message: clip(fields.message, 500) ?? 'Unknown error',
    page: clip(window.location.pathname + window.location.search, 500) ?? '/',
  };
  const code = clip(fields.code, 60);
  if (code) body.code = code;
  const key = clip(mutation, 120);
  if (key) body.mutation = key;
  const ref = clip(digest, 100);
  if (ref) body.digest = ref;

  try {
    void fetch('/api/alerts/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Survives a navigation or reload straight after the failure.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fetch itself can throw synchronously on a malformed request.
  }
}
