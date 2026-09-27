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

import { logger } from '@/lib/alerts/logger';
import {
  AUTOMATED_SEND_WINDOW_MS,
  automatedSendWindowReopensAt,
  readAutomatedSendWindow,
} from '@/lib/email/send-log';

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
  /**
   * Records `weight` requests for `key` (default 1) and returns whether
   * the key is still under the limit. `weight` lets one call stand in
   * for several units of work (e.g. a single automated step that sends
   * to more than one recipient) so the budget tracks real volume
   * instead of call count. A call against a fresh window is always
   * admitted, even when `weight` exceeds `max`, and drains the window;
   * the same call against a partly used window is refused.
   */
  check(key: string, weight?: number): Promise<LimiterCheckResult>;
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
    async check(key: string, weight = 1): Promise<LimiterCheckResult> {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: weight, resetAt: now + windowMs });
        // A fresh, full bucket always admits the call, even one weighed
        // above `max`, and that call drains it. Refusing it here could
        // never succeed later: every retry would land in another fresh
        // bucket and be refused again, forever. That was a workflow step
        // addressing more recipients than the burst allows (a run sheet
        // to 25 vendors) re-parking every minute and never sending. A
        // partly used bucket still refuses it below, with a finite
        // `retryAfter`, so it waits for the next fresh window.
        return { allowed: true, remaining: Math.max(0, max - weight), retryAfter: windowMs };
      }
      existing.count += weight;
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
 * - redeemRecoveryCode: 5 per 15 minutes per user. The caller already
 *   holds the password (an aal1 session), so each guess is against
 *   the last line of defence; a person reading a code off paper needs
 *   two or three tries at most (Phase 4, Task 23).
 * - issueRecoveryCodes: 5/min per user. Each call runs ten scrypt
 *   hashes, so an unthrottled loop is a cheap way to burn CPU.
 * - verifyTotpUser / verifyTotpIp: authenticator code checks, both keys
 *   must pass. Supabase only limits code checks per IP, so a guesser
 *   spread over many IPs meets the per-user key (10 per 15 min; a real MC
 *   mistypes a 6-digit code once or twice) and one IP hammering many
 *   accounts meets the per-IP key (30 per 15 min, room for an office of
 *   MCs behind one address).
 */
export const AUTH_RATE_LIMITS = {
  login: { windowMs: 60_000, max: 10 },
  signup: { windowMs: 3_600_000, max: 3 },
  resetPassword: { windowMs: 3_600_000, max: 5 },
  updatePassword: { windowMs: 60_000, max: 5 },
  changePassword: { windowMs: 60_000, max: 5 },
  redeemRecoveryCode: { windowMs: 15 * 60_000, max: 5 },
  issueRecoveryCodes: { windowMs: 60_000, max: 5 },
  verifyTotpUser: { windowMs: 15 * 60_000, max: 10 },
  verifyTotpIp: { windowMs: 15 * 60_000, max: 30 },
} as const satisfies Record<string, LimiterOptions>;

export type AuthRateLimitKey = keyof typeof AUTH_RATE_LIMITS;

/**
 * Canonical rate-limit thresholds for the Stripe API surface
 * (Phase 2A). Money paths are protected by per-user limits (cheap
 * for normal use, but stops accidental loops + naive abuse). The
 * public `invoicePayment` route uses per-IP since payers aren't
 * logged in.
 *
 * - **checkout**: 5/min/user — checkout sessions are expensive to
 *   create on Stripe's side and humans don't legitimately fire
 *   them more than a couple of times per minute.
 * - **portal**: 10/min/user — clicking around the in-app billing
 *   flows generates a few of these per session.
 * - **billingHistory**: 30/min/user — read-only and cheap on our
 *   side, but Stripe's invoice list API does have its own limits;
 *   30 covers any reasonable UI without burning their quota.
 * - **invoicePayment**: 10/min/IP — public surface, no session to
 *   key on. Tighter than the others because guessable tokens are
 *   the threat we're defending against.
 */
export const STRIPE_RATE_LIMITS = {
  checkout: { windowMs: 60_000, max: 5 },
  portal: { windowMs: 60_000, max: 10 },
  billingHistory: { windowMs: 60_000, max: 30 },
  invoicePayment: { windowMs: 60_000, max: 10 },
  // Billing-tab server actions (Phase 2B). All four are
  // intentional, per-session user actions — a healthy human fires
  // them maybe once or twice in a session. 5/min/user is generous
  // for typos and double-clicks but stops scripted abuse.
  cancelSubscription: { windowMs: 60_000, max: 5 },
  resumeSubscription: { windowMs: 60_000, max: 5 },
  changePlan: { windowMs: 60_000, max: 5 },
  paymentMethod: { windowMs: 60_000, max: 5 },
} as const satisfies Record<string, LimiterOptions>;

export type StripeRateLimitKey = keyof typeof STRIPE_RATE_LIMITS;

/**
 * Email-send rate-limits (Phase 2C). These cap how often an MC
 * can blast their couple's inbox — the real risk is an accidental
 * loop from a misbehaving client (or a compromised session) firing
 * the "send invoice" button on repeat.
 *
 * - **sendProposal / sendInvoice**: 5/min/user. Resends are normal
 *   (the modal exposes a "Resend email" button); we just stop
 *   runaway loops.
 * - Per-user keys, not per-IP — these are authenticated routes.
 */
export const EMAIL_RATE_LIMITS = {
  sendProposal: { windowMs: 60_000, max: 5 },
  sendInvoice: { windowMs: 60_000, max: 5 },
  sendTemplate: { windowMs: 60_000, max: 5 },
} as const satisfies Record<string, LimiterOptions>;

export type EmailRateLimitKey = keyof typeof EMAIL_RATE_LIMITS;

/**
 * Public Page settings rate-limits.
 *
 * - **saveSubdomain**: 20/min/user — a debounced auto-save field; a
 *   human typing fires a handful, we just stop runaway loops.
 * - **mailboxMutation**: 10/min/user — covers the connected-mailbox
 *   actions (disconnect, mode toggle). The OAuth connect/callback flow
 *   is rate-limited in its own routes.
 */
export const PUBLIC_PAGE_RATE_LIMITS = {
  saveSubdomain: { windowMs: 60_000, max: 20 },
  mailboxMutation: { windowMs: 60_000, max: 10 },
} as const satisfies Record<string, LimiterOptions>;

export type PublicPageRateLimitKey = keyof typeof PUBLIC_PAGE_RATE_LIMITS;

/**
 * In-app feedback rate-limits.
 *
 * - **submit**: 10/hour/user. An MC hitting a genuinely bad afternoon might
 *   file three or four reports; ten is well clear of that and still stops a
 *   stuck submit button from filling the Notion queue. Keyed per user rather
 *   than per IP because the route is authenticated, so the limit follows the
 *   account rather than the coffee shop.
 */
export const BUG_REPORT_RATE_LIMITS = {
  submit: { windowMs: 3_600_000, max: 10 },
} as const satisfies Record<string, LimiterOptions>;

export type BugReportRateLimitKey = keyof typeof BUG_REPORT_RATE_LIMITS;

/**
 * Contract surface rate-limits.
 *
 * The public contract routes are unauthenticated and token-gated, so every
 * limit here is keyed by IP or by a hash of the capability token, never by
 * user. The first four values are lifted unchanged from the literals that were
 * previously inlined in each route; collecting them here makes the whole
 * surface's posture reviewable in one place.
 *
 * - **sign** / **decline**: 3/min/IP. Signing is a once-ever act; three
 *   attempts covers a fat-fingered name and a retry after a flaky connection.
 * - **view**: 20/min/IP. A passive beacon fired on page load, so this only
 *   catches a reload loop. The route swallows its own 429.
 * - **send**: 10/min/IP on the authenticated MC-side send.
 * - **otpRequestIp**: 10 per 10 min/IP. The coarse net.
 * - **otpRequestToken**: 1/min, and **otpRequestTokenHour** 5/hour, both keyed
 *   on a hash of the sign token. This pair is what actually protects a
 *   signer's inbox from being used as a mail cannon: a per-IP limit alone does
 *   nothing against rotating addresses, because the attacker's target is a
 *   fixed mailbox, not a fixed source.
 * - **otpVerify**: 10/min/IP as a network-level brake only. The real control
 *   on guessing is the per-row attempt counter and lockout, which no amount of
 *   IP rotation can evade.
 * - **verifyHash**: 20/min/IP on the public document-fingerprint lookup.
 */
export const CONTRACT_RATE_LIMITS = {
  sign: { windowMs: 60_000, max: 3 },
  decline: { windowMs: 60_000, max: 3 },
  view: { windowMs: 60_000, max: 20 },
  send: { windowMs: 60_000, max: 10 },
  otpRequestIp: { windowMs: 600_000, max: 10 },
  otpRequestToken: { windowMs: 60_000, max: 1 },
  otpRequestTokenHour: { windowMs: 3_600_000, max: 5 },
  otpVerify: { windowMs: 60_000, max: 10 },
  verifyHash: { windowMs: 60_000, max: 20 },
} as const satisfies Record<string, LimiterOptions>;

export type ContractRateLimitKey = keyof typeof CONTRACT_RATE_LIMITS;

/**
 * Proposal-close rate-limits. Both public, unauthenticated, token-gated
 * routes: `accept` and `decline` are each a one-shot event per couple, so
 * 5/min/IP is generous headroom for a fat-fingered retry while still
 * stopping a scripted loop.
 *
 * - **events**: 30/min/IP. The public page's engagement tracker flushes its
 *   batch every 10s and again on `pagehide`, so one tab is ~6 requests a
 *   minute; 30 leaves room for a couple in front of a couple of tabs (their
 *   phone and a laptop open to the same link) plus a retry or two without
 *   opening the door to a scripted batch-spam loop.
 */
export const PROPOSAL_RATE_LIMITS = {
  accept: { windowMs: 60_000, max: 5 },
  decline: { windowMs: 60_000, max: 5 },
  events: { windowMs: 60_000, max: 30 },
} as const satisfies Record<string, LimiterOptions>;

export type ProposalRateLimitKey = keyof typeof PROPOSAL_RATE_LIMITS;

/**
 * Shadow-mode exit refusal limits. `exitShadow` is a server action anyone
 * can post, and every refusal alerts Slack, so an unauthenticated script
 * could otherwise bury real takeover attempts under noise.
 *
 * - **exitRefusalIp**: 5/min/IP. After that a refusal still refuses and
 *   still signs the browser out, it just stops alerting.
 * - **exitRefusalAlerts**: 10 alerts per 10 min across all IPs, one key.
 *   Caps the channel when the flood comes from many addresses.
 */
export const SHADOW_RATE_LIMITS = {
  exitRefusalIp: { windowMs: 60_000, max: 5 },
  exitRefusalAlerts: { windowMs: 600_000, max: 10 },
} as const satisfies Record<string, LimiterOptions>;

/**
 * Unsubscribe rate-limits (Phase 2, Task 11). Public, unauthenticated,
 * token-gated: keyed per IP, same as the other public surfaces above.
 *
 * - **confirm**: 20/min/IP on `POST /api/unsubscribe`. The action is a
 *   one-shot, idempotent write (a repeat is a no-op, see the route), so
 *   this only needs to stop a scripted loop, not protect against a human
 *   double-click. Left generous relative to the contract/proposal one-shot
 *   actions (3-5/min) because a shared office or campus IP can plausibly
 *   have several genuine unsubscribes land in the same minute.
 */
export const UNSUBSCRIBE_RATE_LIMITS = {
  confirm: { windowMs: 60_000, max: 20 },
} as const satisfies Record<string, LimiterOptions>;

export type UnsubscribeRateLimitKey = keyof typeof UNSUBSCRIBE_RATE_LIMITS;

/**
 * Per-tenant automated-send limits (workflows trust remediation, Task 15).
 *
 * Every MC's automated sends go out through the same shared Resend
 * domain, so one runaway workflow (a wait loop with no exit condition, a
 * trigger misfiring in a cycle, or a workflow applied to an MC's entire
 * back catalogue by mistake) can damage deliverability for every tenant
 * on the platform, not just the one who triggered it. Two independent
 * thresholds guard the domain, both keyed per tenant (`ctx.userId`), not
 * per IP: these are authenticated, server-initiated sends with no
 * request to key on.
 *
 * - **burst** (per minute): sized around the busiest minute a real MC's
 *   business produces. The executor's own tick budget caps how many
 *   steps can run across ALL tenants in one minute at 200
 *   (`STEP_BUDGET_PER_TICK` in `lib/workflows/executor.ts`), so 20/min
 *   for a single tenant is already a tenth of the entire platform's
 *   per-minute ceiling. A human applying a workflow to a handful of
 *   couples who all hit a milestone in the same hour sends a handful of
 *   emails a minute; a mistargeted trigger or a step that keeps
 *   re-firing sends dozens, and 20/min catches that within the first
 *   minute or two rather than after it has already gone out.
 * - **daily cap**: the backstop for exactly the case the burst limit is
 *   deliberately too generous for, a workflow applied on purpose to a
 *   large back catalogue (hundreds of couples), which legitimately
 *   wants to send that many emails, just spread across many burst
 *   windows rather than one. A solo or small studio MC blasting their
 *   entire multi-year couple list in a single day, the single most
 *   aggressive legitimate action the product supports, tops out in the
 *   low hundreds. 500/day/tenant sits comfortably above that (a couple
 *   thousand couples' worth of history, sent all at once, is not a real
 *   MC's business) and stays far below what an uncapped runaway would
 *   produce over the same period (a step re-firing every minute for a
 *   day could otherwise reach into the tens of thousands).
 *
 * Both numbers are a starting point, not a promise: ratchet them once
 * real tenant volume is observed. Too tight shows up immediately as a
 * `workflow_send_rate_limited` alert on a legitimate account; too loose
 * shows up as a deliverability complaint, which is the failure mode
 * this exists to prevent.
 *
 * Where each counter lives. The burst limit is in this process's
 * memory, which suits it: a minute is far shorter than a container's
 * life, and a runaway step fires inside one tick, in one process. The
 * daily cap is not: it counts the tenant's automated `couple_emails`
 * rows sent through the shared domain (`transport = 'resend'`, one row
 * per message however often it was retried) from the last 24 hours
 * (Task 30, `readAutomatedSendWindow` in
 * `lib/email/send-log`), so it is the same figure in every process,
 * survives a cold start, and is shared by the cron tick and manual
 * approve-and-send.
 */
export const WORKFLOW_SEND_BURST_LIMIT: LimiterOptions = { windowMs: 60_000, max: 20 };

/**
 * The daily cap: at most `max` automated sends per tenant in any
 * trailing `windowMs`. Counted from `couple_emails`, not held in memory
 * (see {@link WORKFLOW_SEND_BURST_LIMIT}).
 */
export const WORKFLOW_SEND_DAILY_CAP: LimiterOptions = { windowMs: AUTOMATED_SEND_WINDOW_MS, max: 500 };

/**
 * The shortest deferral a daily-cap refusal asks for. The window reopens
 * when the oldest counted row ages out, which can be seconds away; a
 * minute (the tick's own period) keeps a capped step from waking again
 * straight away only to be refused again. Also the retry after a count
 * that could not be read.
 */
const DAILY_CAP_MIN_RETRY_MS = 60_000;

const workflowSendBurstLimiter: Limiter = inMemoryLimiter(WORKFLOW_SEND_BURST_LIMIT);

/**
 * Which threshold a send attempt was stopped by. `daily_cap_unreadable`
 * is not a threshold being hit: the daily count could not be read, so
 * the send is held (fail closed) until it can be. Kept distinct so the
 * alert and the MC-facing wording never claim a limit was reached.
 */
export type WorkflowSendLimitScope = 'burst' | 'daily_cap' | 'daily_cap_unreadable';

/**
 * One `workflow_send_cap_unreadable` alert per tenant per ten minutes.
 * An unreadable count is usually a database-wide problem that holds
 * every tenant's sends at once, and each parked step re-checks every
 * minute; ten minutes keeps the channel readable while still saying,
 * well inside an hour, that it has not cleared.
 */
const CAP_UNREADABLE_ALERT_WINDOW: LimiterOptions = { windowMs: 10 * 60 * 1000, max: 1 };

/**
 * One Slack ping per {tenant, threshold, window}, not one per deferred
 * step. A bulk apply that trips the burst limit can defer dozens of
 * steps inside the same tick; without this every one of them would fire
 * its own alert. Mirrors the `alertDedup` bucket in
 * `lib/api/public-token-limiter.ts`. Held in memory even for the daily
 * cap: a second alert after a cold start is noise, not harm.
 */
const workflowSendAlertDedup: Record<WorkflowSendLimitScope, Limiter> = {
  burst: inMemoryLimiter({ windowMs: WORKFLOW_SEND_BURST_LIMIT.windowMs, max: 1 }),
  daily_cap: inMemoryLimiter({ windowMs: WORKFLOW_SEND_DAILY_CAP.windowMs, max: 1 }),
  daily_cap_unreadable: inMemoryLimiter(CAP_UNREADABLE_ALERT_WINDOW),
};

export interface WorkflowSendLimitResult {
  /** True when the attempt is clear to send. */
  allowed: boolean;
  /** Which threshold was hit. Undefined when `allowed`. */
  scope?: WorkflowSendLimitScope;
  /** Milliseconds until this tenant's window for `scope` resets. 0 when allowed. */
  retryAfterMs: number;
  /**
   * True at most once per {tenant, scope, window}. The caller's cue to
   * raise an alert rather than defer silently on every retry of the
   * same breach.
   */
  shouldAlert: boolean;
  /**
   * Set only on a `daily_cap_unreadable` result: the database or
   * PostgREST error code the count failed with (null when the client
   * threw). A code, never a message, so it is safe for Slack.
   */
  errorCode?: string | null;
}

/**
 * Check one send attempt against both per-tenant thresholds, and record
 * it against the burst limit if it clears.
 *
 * `weight` is the number of individual recipient sends this attempt
 * represents (a single `send_email` step can address more than one
 * recipient), so the budget tracks real send volume rather than step
 * count.
 *
 * Burst first, in memory, so a tenant hammering inside one minute never
 * costs a database read. Then the daily cap, from the send log: nothing
 * is recorded for it here, because the rows the sends write ARE the
 * record. A burst check passing right before a daily breach still
 * records a phantom burst count for an attempt that was deferred, but
 * the burst window is a minute long and self-corrects long before the
 * daily window that blocked the attempt reopens.
 *
 * The daily cap admits an attempt against an empty window even when
 * `weight` alone exceeds `max`, like {@link inMemoryLimiter}'s fresh
 * window: otherwise one step addressing more than `max` recipients
 * could never send at all. A count that cannot be read defers (fails
 * closed) for {@link DAILY_CAP_MIN_RETRY_MS} as `daily_cap_unreadable`:
 * the cap is only a backstop if it holds when the database is
 * struggling. It is not silent: `shouldAlert` is set once per tenant per
 * ten minutes, because a persistent failure holds every shared-domain
 * send while the tick itself looks healthy.
 *
 * On a breach the retry is when enough rows have aged out for this
 * attempt to fit ({@link automatedSendWindowReopensAt}), never earlier
 * than {@link DAILY_CAP_MIN_RETRY_MS}.
 *
 * Concurrent attempts for one tenant (a tick and an approve-and-send in
 * the same second) can both read the count before either logs, so the
 * cap can be overshot by one step's recipients. It is a brake on a
 * runaway, which sends thousands; a handful over is not what it is for.
 */
export async function checkWorkflowSendLimit(
  userId: string,
  weight = 1,
): Promise<WorkflowSendLimitResult> {
  const burst = await workflowSendBurstLimiter.check(userId, weight);
  if (!burst.allowed) {
    const dedup = await workflowSendAlertDedup.burst.check(userId);
    return { allowed: false, scope: 'burst', retryAfterMs: burst.retryAfter, shouldAlert: dedup.allowed };
  }

  const now = Date.now();
  const window = await readAutomatedSendWindow(userId, now);
  if (window.status === 'unknown') {
    logger.error('[rate-limit] daily send count unreadable, deferring', { userId, reason: window.reason });
    const dedup = await workflowSendAlertDedup.daily_cap_unreadable.check(userId);
    return {
      allowed: false,
      scope: 'daily_cap_unreadable',
      retryAfterMs: DAILY_CAP_MIN_RETRY_MS,
      shouldAlert: dedup.allowed,
      errorCode: window.code,
    };
  }
  if (window.count > 0 && window.count + weight > WORKFLOW_SEND_DAILY_CAP.max) {
    const mustAgeOut = Math.min(window.count + weight - WORKFLOW_SEND_DAILY_CAP.max, window.count);
    const reopensAt = (await automatedSendWindowReopensAt(userId, mustAgeOut, now)) ?? now;
    const dedup = await workflowSendAlertDedup.daily_cap.check(userId);
    return {
      allowed: false,
      scope: 'daily_cap',
      retryAfterMs: Math.max(reopensAt - now, DAILY_CAP_MIN_RETRY_MS),
      shouldAlert: dedup.allowed,
    };
  }
  return { allowed: true, retryAfterMs: 0, shouldAlert: false };
}

/**
 * Test-only reset for the module-level workflow-send buckets (the burst
 * limiter and both alert dedups). Also what a process restart does, so
 * the daily-cap tests call it to prove the cap survives one. Mirrors
 * `_resetForTest` in `lib/api/public-token-limiter.ts`.
 */
export function _resetWorkflowSendLimitersForTest(): void {
  Object.assign(workflowSendBurstLimiter, inMemoryLimiter(WORKFLOW_SEND_BURST_LIMIT));
  Object.assign(
    workflowSendAlertDedup.burst,
    inMemoryLimiter({ windowMs: WORKFLOW_SEND_BURST_LIMIT.windowMs, max: 1 }),
  );
  Object.assign(
    workflowSendAlertDedup.daily_cap,
    inMemoryLimiter({ windowMs: WORKFLOW_SEND_DAILY_CAP.windowMs, max: 1 }),
  );
  Object.assign(workflowSendAlertDedup.daily_cap_unreadable, inMemoryLimiter(CAP_UNREADABLE_ALERT_WINDOW));
}
