/**
 * Stripe webhook event parsing + replay tracking.
 *
 * The webhook handler trusts Stripe's signature (verified at the
 * boundary by `stripe.webhooks.constructEvent`), but it should NOT
 * trust the shape of `event.data.object`. Stripe's API evolves —
 * fields move (e.g. `current_period_end` moved off the subscription
 * root and onto its items), get renamed, get deprecated. The casts
 * we used to do (`event.data.object as Stripe.Subscription`) hide
 * that drift until production blows up.
 *
 * This module:
 * 1. Declares **per-event Zod schemas** for every event type the
 *    handler dispatches. Schemas pin only the fields we actually
 *    read — not the whole Stripe object — so unrelated API changes
 *    don't break us.
 * 2. Exposes `parseStripeEvent(type, dataObject)` returning a
 *    tagged discriminated union the handler can `switch` over with
 *    full type safety.
 * 3. Exposes `recordReplayAttempt(eventId)` + `shouldAlertOnReplay()`
 *    for the §11.2-locked alerting policy (warn on every replay,
 *    alert only when the same event ID is replayed ≥ 3 times within
 *    60 seconds — see [[phase_2_payments]] §11.2).
 *
 * The replay counter is **in-memory** (process-local). The
 * idempotency LEDGER (`stripe_events` table) is the durable
 * cross-process guard. This counter is purely for alert noise
 * control. A pod restart clearing the counter just means we won't
 * alert on a long-tail replay storm — which is fine; the ledger
 * already prevented any double side effects.
 *
 * @module lib/payments/webhook-events
 */
import { z } from 'zod';

/* ─── Per-event schemas ────────────────────────────────────────── */

/**
 * Common shape for any Stripe subscription item that carries the
 * `current_period_end` we use to compute renewal/access dates.
 * Stripe moved this field from the subscription root to the items
 * array in a recent API version; we read both locations and fall
 * back accordingly (see {@link readPeriodEndIso}).
 */
const subscriptionItemSchema = z.object({
  price: z.object({ id: z.string() }).nullable().optional(),
  current_period_end: z.number().int().positive().optional(),
});

/**
 * `checkout.session.completed` — fires twice in our handler's life:
 *
 * - **Subscription path:** `mode='subscription'`, carries `customer`
 *   + `subscription` IDs. The handler retrieves the full
 *   subscription from Stripe afterward; the session schema only
 *   needs to expose enough to route the event correctly.
 * - **Invoice path:** `metadata.invoice_id` is set (Connect-mediated
 *   couple → MC payment). The handler reads `metadata.payment_type`
 *   to distinguish deposit / final / full payment, and
 *   `payment_intent` for receipt reference.
 */
const checkoutSessionCompletedSchema = z.object({
  id: z.string(),
  mode: z.string(),
  customer: z.string().nullable().optional(),
  subscription: z.string().nullable().optional(),
  payment_intent: z.union([z.string(), z.null()]).optional(),
  metadata: z
    .object({
      invoice_id: z.string().optional(),
      payment_type: z.string().optional(),
      plan: z.string().optional(),
      supabase_user_id: z.string().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * `customer.subscription.{created,updated,deleted}` — the most
 * load-bearing event type. Drives `app_metadata` for active /
 * cancelling / past-due / cancelled states on the plan card.
 *
 * `cancel_at_period_end` is `false` on deletion; the handler infers
 * "cancelled" from the event type itself, not from this flag.
 */
const customerSubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer: z.union([
    z.string(),
    z.object({ id: z.string() }),
    z.null(),
  ]),
  cancel_at_period_end: z.boolean().optional(),
  trial_end: z.number().int().nullable().optional(),
  current_period_end: z.number().int().positive().optional(),
  items: z.object({
    data: z.array(subscriptionItemSchema),
  }),
  metadata: z
    .object({
      supabase_user_id: z.string().optional(),
      plan: z.string().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * `invoice.payment_failed` — moves subscription to `past_due`. We
 * only read enough to identify the user + raise an alert with the
 * failed amount.
 */
const invoicePaymentFailedSchema = z.object({
  id: z.string(),
  customer: z.union([
    z.string(),
    z.object({ id: z.string() }),
    z.null(),
  ]),
  amount_due: z.number().int(),
  metadata: z
    .object({ supabase_user_id: z.string().optional() })
    .nullable()
    .optional(),
});

/**
 * `invoice.payment_succeeded` — recovers past_due → active and
 * fires the recurring-charge alert. `billing_reason` is what lets
 * us suppress the noisy "first charge" event (that's handled by
 * `checkout.session.completed` instead).
 */
const invoicePaymentSucceededSchema = z.object({
  id: z.string(),
  customer: z.union([
    z.string(),
    z.object({ id: z.string() }),
    z.null(),
  ]),
  amount_paid: z.number().int(),
  billing_reason: z.string().nullable().optional(),
  metadata: z
    .object({ supabase_user_id: z.string().optional() })
    .nullable()
    .optional(),
});

/* ─── Dispatch + types ─────────────────────────────────────────── */

/**
 * Tagged union returned by {@link parseStripeEvent}. The handler
 * `switch`es on `type` and gets a narrowed `data` field for free.
 */
export type ParsedStripeEvent =
  | {
      type: 'checkout.session.completed';
      data: z.infer<typeof checkoutSessionCompletedSchema>;
    }
  | {
      type: 'customer.subscription.created';
      data: z.infer<typeof customerSubscriptionSchema>;
    }
  | {
      type: 'customer.subscription.updated';
      data: z.infer<typeof customerSubscriptionSchema>;
    }
  | {
      type: 'customer.subscription.deleted';
      data: z.infer<typeof customerSubscriptionSchema>;
    }
  | {
      type: 'invoice.payment_failed';
      data: z.infer<typeof invoicePaymentFailedSchema>;
    }
  | {
      type: 'invoice.payment_succeeded';
      data: z.infer<typeof invoicePaymentSucceededSchema>;
    };

/** Stripe event types the handler currently dispatches. */
export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export interface ParseFailure {
  ok: false;
  /** The Zod issues, for logging / alerting. */
  issues: { path: string; code: string; message: string }[];
}

export interface ParseSuccess {
  ok: true;
  event: ParsedStripeEvent;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Validate `event.data.object` against the schema for `eventType`.
 *
 * The caller has already verified the Stripe signature — we trust
 * that the event came from Stripe but NOT that its shape is what
 * we expect. Returns a tagged result; the handler's job on
 * `ok: false` is to log + alert (`stripe_webhook_failed`) and
 * return 200 anyway (Stripe shouldn't retry a malformed event).
 */
export function parseStripeEvent(
  eventType: string,
  dataObject: unknown,
): ParseResult {
  switch (eventType) {
    case 'checkout.session.completed': {
      const parsed = checkoutSessionCompletedSchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const parsed = customerSubscriptionSchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    case 'invoice.payment_failed': {
      const parsed = invoicePaymentFailedSchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    case 'invoice.payment_succeeded': {
      const parsed = invoicePaymentSucceededSchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    default:
      // Unknown event type. Caller should ack with 200 + log; Stripe
      // sends a wide spectrum and we only need to handle what we
      // explicitly subscribed to in the Dashboard.
      return {
        ok: false,
        issues: [
          {
            path: '_',
            code: 'unhandled_event_type',
            message: `No schema registered for "${eventType}"`,
          },
        ],
      };
  }
}

function failure(error: z.ZodError): ParseFailure {
  return {
    ok: false,
    issues: error.issues.map((i) => ({
      path: i.path.join('.'),
      code: i.code,
      message: i.message,
    })),
  };
}

/* ─── Shared period-end reader ─────────────────────────────────── */

/**
 * Read the subscription's `current_period_end` as an ISO timestamp.
 *
 * Stripe moved this field from the subscription root onto its items
 * array in a recent API version. Older subscriptions still carry it
 * at the root; new ones only on items. Read items first, fall back
 * to root.
 *
 * Returns `null` when neither location has a value (e.g. canceled
 * subscriptions where Stripe sometimes drops the field entirely) —
 * callers decide whether to skip the field or default to `undefined`.
 */
export function readPeriodEndIso(subscription: {
  current_period_end?: number | undefined;
  items: { data: Array<{ current_period_end?: number | undefined }> };
}): string | null {
  const fromItem = subscription.items.data[0]?.current_period_end;
  const fromRoot = subscription.current_period_end;
  const unix = fromItem ?? fromRoot;
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

/* ─── Replay tracking (§11.2) ──────────────────────────────────── */

interface ReplayBucket {
  count: number;
  firstSeenAt: number;
}

const REPLAY_WINDOW_MS = 60_000;
const REPLAY_ALERT_THRESHOLD = 3;
const REPLAY_MAX_ENTRIES = 1_000;

const replayCounter = new Map<string, ReplayBucket>();

/**
 * Record that we've seen `eventId` arrive more than once. Returns
 * the new count + whether the {@link REPLAY_ALERT_THRESHOLD} was
 * just crossed (used by the handler to fire `stripe_webhook_replay`
 * exactly once per breach, not on every retry past the threshold).
 *
 * Window: 60 seconds rolling per event ID. Entries past the window
 * are reset on next observation. The map is capped at 1k entries;
 * when full, the oldest entry by `firstSeenAt` is evicted.
 */
export function recordReplayAttempt(eventId: string): {
  count: number;
  alertNow: boolean;
} {
  const now = Date.now();
  const existing = replayCounter.get(eventId);

  if (!existing || now - existing.firstSeenAt > REPLAY_WINDOW_MS) {
    // First seen, or window expired — reset.
    if (replayCounter.size >= REPLAY_MAX_ENTRIES) evictOldest(now);
    replayCounter.set(eventId, { count: 1, firstSeenAt: now });
    return { count: 1, alertNow: false };
  }

  existing.count += 1;
  // Fire exactly at the threshold (not every subsequent replay)
  // so one breach = one Slack message.
  const alertNow = existing.count === REPLAY_ALERT_THRESHOLD;
  return { count: existing.count, alertNow };
}

function evictOldest(now: number): void {
  let oldestKey: string | undefined;
  let oldestAt = now;
  for (const [key, bucket] of replayCounter) {
    if (bucket.firstSeenAt < oldestAt) {
      oldestAt = bucket.firstSeenAt;
      oldestKey = key;
    }
  }
  if (oldestKey) replayCounter.delete(oldestKey);
}

/** Test-only: clear the in-memory replay counter between tests. */
export function _resetReplayCounterForTest(): void {
  replayCounter.clear();
}
