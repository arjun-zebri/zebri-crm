/**
 * Rate-limit infrastructure (Phase 0.8a — interface + in-memory impl).
 *
 * Used to protect auth, public, and money paths from abuse. The
 * in-memory store works **per Node process**, which is best-effort on
 * serverless platforms like Vercel — a determined attacker can spread
 * requests across cold starts. Good enough for blocking accidental
 * loops, scraping, and naive enumeration; upgrade to a centralised
 * store (Upstash Redis) before public launch / when traffic warrants.
 *
 * The interface is stable so call sites don't change when the store
 * upgrades — just swap `inMemoryLimiter` for `redisLimiter`.
 *
 * Per-route adoption (auth routes, /api/stripe/invoice-payment,
 * /api/contract/*, etc.) happens during each surface's hardening.
 *
 * @example
 * ```ts
 * import { inMemoryLimiter } from '@/lib/api/rate-limit';
 *
 * const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });
 *
 * export async function POST(request: Request) {
 *   const key = ipOf(request);
 *   const { allowed, retryAfter } = await limiter.check(key);
 *   if (!allowed) {
 *     return new Response('Too Many Requests', {
 *       status: 429,
 *       headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
 *     });
 *   }
 *   // … real work …
 * }
 * ```
 *
 * @module lib/api/rate-limit
 */

export interface LimiterOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests per `key` per window. */
  max: number;
}

export interface LimiterCheckResult {
  /** True if the request is under the limit (let it through). */
  allowed: boolean;
  /** Remaining requests in the current window before blocking. */
  remaining: number;
  /** Milliseconds until the bucket resets. */
  retryAfter: number;
}

export interface Limiter {
  /** Records one request for `key` and returns whether it should be allowed. */
  check(key: string): Promise<LimiterCheckResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Process-local sliding-window-ish limiter. Map keys evict on next
 * `check` whose `resetAt` has passed, so memory grows only with active
 * keys in the current window.
 */
export function inMemoryLimiter({ windowMs, max }: LimiterOptions): Limiter {
  const buckets = new Map<string, Bucket>();

  return {
    async check(key: string): Promise<LimiterCheckResult> {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1, retryAfter: windowMs };
      }
      existing.count += 1;
      const remaining = Math.max(0, max - existing.count);
      const retryAfter = Math.max(0, existing.resetAt - now);
      return { allowed: existing.count <= max, remaining, retryAfter };
    },
  };
}

/**
 * Extract a best-effort client IP from a request — prefers Vercel's
 * `x-forwarded-for` chain (left-most non-private hop), falls back to
 * `x-real-ip`, then `unknown`. Use as the limiter key for public routes.
 */
export function ipOf(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Extract a best-effort client IP from a `Headers` instance —
 * server-action variant of {@link ipOf}. Server actions get the
 * request headers from `next/headers.headers()` rather than a
 * `Request` object.
 */
export function ipOfHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Canonical rate-limit thresholds for the auth + account flows
 * (Phase 1). Exported so tests and call sites use the same numbers,
 * and so we have a single place to ratchet them as we learn what
 * real traffic looks like.
 *
 * Tuned to catch scripted abuse without friction for real users:
 * - login: someone fat-fingering their password 10× in a minute is
 *   already in the "stop and reset" zone.
 * - signup: 3 new accounts per hour from one IP covers families on
 *   shared NAT; bots typically want orders of magnitude more.
 * - password resets: 5/hour matches Auth provider best practice.
 * - in-session change/update password: 5/min is generous; anything
 *   beyond is automation.
 */
export const AUTH_RATE_LIMITS = {
  login: { windowMs: 60_000, max: 10 },
  signup: { windowMs: 3_600_000, max: 3 },
  resetPassword: { windowMs: 3_600_000, max: 5 },
  updatePassword: { windowMs: 60_000, max: 5 },
  changePassword: { windowMs: 60_000, max: 5 },
} as const satisfies Record<string, LimiterOptions>;

export type AuthRateLimitKey = keyof typeof AUTH_RATE_LIMITS;
