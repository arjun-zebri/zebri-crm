/**
 * Token-attempt limiter for public-surface routes
 * (`/invoice/[token]`, `/proposal/[token]`, `/portal/[token]`,
 * `/contract/[token]`).
 *
 * Why a separate module from `rate-limit.ts`?
 *
 * The general per-route rate-limiter caps *every* request. The
 * threat model here is narrower + different — a leaked or guessed
 * share token gives an attacker the full payload of the document.
 * We want to:
 *
 * 1. **Cap the total volume** of invalid-token attempts from one IP
 *    over a long window (60/hr). Past that → 429, suspect scanning.
 * 2. **Detect bursts** — 10+ invalid attempts in 60s is almost
 *    certainly enumeration. Fire a Slack alert (`public_token_attempt_burst`)
 *    so we can react operationally, *and* keep blocking via the
 *    long-window cap.
 *
 * Only **invalid** attempts count toward the limit. Successful
 * loads of a valid token (the couple actually using their invoice
 * link) are free — a couple refreshing their invoice page 100x is
 * normal traffic.
 *
 * Process-local in-memory implementation, same caveat as
 * {@link rate-limit}: best-effort on serverless. A determined
 * attacker can spread requests across cold starts. Good enough to
 * stop accidental loops + naive enumeration. Upgrade to a
 * centralised store (Upstash Redis) before public launch.
 *
 * @example
 * ```ts
 * // In a server component or RPC handler:
 * import { headers } from 'next/headers';
 * import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
 *
 * const data = await fetchPublicInvoice(token);
 * if (!data) {
 *   const result = await recordInvalidTokenAttempt({
 *     ip: ipOfHeaders(await headers()),
 *     surface: 'invoice',
 *   });
 *   if (!result.allowed) {
 *     // Render a generic 404 — never leak that the token would
 *     // have been valid past the limit.
 *     notFound();
 *   }
 *   notFound();
 * }
 * ```
 *
 * @module lib/api/public-token-limiter
 */
import { sendAlert } from '@/lib/alerts/send-alert';

import { inMemoryLimiter, type Limiter } from './rate-limit';

/** Surfaces gated by this limiter. Identifies the route in alerts. */
export type PublicSurface = 'invoice' | 'quote' | 'portal' | 'contract';

export interface RecordResult {
  /** True if the request is under both thresholds. */
  allowed: boolean;
  /** Milliseconds until the long bucket resets (informational). */
  retryAfter: number;
}

export interface RecordArgs {
  ip: string;
  surface: PublicSurface;
}

/**
 * Three cooperating buckets per IP:
 * - `longBucket` — the hard cap (60 invalid attempts / hour). Drives
 *   the `allowed` result returned to the caller.
 * - `burstBucket` — the burst detector (10 / 60s). When `allowed`
 *   flips to false on this bucket, we've crossed the threshold and
 *   should consider alerting.
 * - `alertDedup` — one-shot per 60s window per IP. Prevents the
 *   burst alert from re-firing on attempts 12, 13, 14, … within
 *   the same window — we want a single Slack ping per burst, not
 *   one per request.
 */
const longBucket: Limiter = inMemoryLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
});
const burstBucket: Limiter = inMemoryLimiter({
  windowMs: 60 * 1000,
  max: 10,
});
const alertDedup: Limiter = inMemoryLimiter({
  windowMs: 60 * 1000,
  max: 1,
});

/**
 * Tracks one invalid-token attempt and returns whether the request
 * should be allowed to surface (caller decides what to render on
 * 429; the convention in this codebase is to render the same 404
 * as a genuine missing token — never leak the rate-limit state).
 *
 * The burst alert fires exactly once per burst-bucket window —
 * i.e. when the IP first crosses 10 attempts in a 60s rolling
 * window. Subsequent attempts in the same window are silently
 * blocked (no alert spam) until the bucket resets.
 */
export async function recordInvalidTokenAttempt(
  args: RecordArgs,
): Promise<RecordResult> {
  const { ip, surface } = args;

  // Long-window check drives the `allowed` flag.
  const long = await longBucket.check(ip);

  // Burst detection — `burst.allowed` flips false on the 11th
  // attempt within 60s. The dedup bucket then gates the actual
  // alert so subsequent attempts (12, 13, …) in the same window
  // don't re-fire it. Result: exactly one Slack ping per
  // {IP, 60s window} where a burst occurs.
  const burst = await burstBucket.check(ip);
  if (!burst.allowed) {
    const dedup = await alertDedup.check(ip);
    if (dedup.allowed) {
      await sendAlert({
        type: 'public_token_attempt_burst',
        severity: 'warn',
        ip,
        surface,
        // Exact count not exposed by the limiter API — pass the
        // threshold + 1 as a floor.
        attempts: 11,
      });
    }
  }

  return {
    allowed: long.allowed,
    retryAfter: long.retryAfter,
  };
}

/**
 * Test-only reset. Used by unit tests so the in-memory buckets
 * don't leak state between cases. Not exported to non-test code via
 * the public barrel.
 */
export function _resetForTest(): void {
  // Re-create both buckets by re-assigning the underlying map. We
  // can't reach into the limiter's closure, so we create fresh
  // limiters and swap references. Vitest tests do this via the
  // exported reference.
  Object.assign(longBucket, inMemoryLimiter({ windowMs: 60 * 60 * 1000, max: 60 }));
  Object.assign(burstBucket, inMemoryLimiter({ windowMs: 60 * 1000, max: 10 }));
  Object.assign(alertDedup, inMemoryLimiter({ windowMs: 60 * 1000, max: 1 }));
}
