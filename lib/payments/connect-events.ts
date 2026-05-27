/**
 * Stripe Connect webhook event parsing + dispatch.
 *
 * Connect events differ from platform events in that they're sent on
 * behalf of a connected account (carry the `stripe-account` header).
 * The platform webhook route already differentiates the two — Connect
 * events route here; platform events route to
 * {@link parseStripeEvent} in `webhook-events.ts`.
 *
 * The three event types we handle:
 *
 * - **`account.updated`** — fires on every meaningful change to the
 *   connected account (capability state, requirements list, business
 *   info, payouts enabled, etc.). We mirror the new state into our
 *   `connect_accounts` table + flip `app_metadata.stripe_connect_enabled`
 *   based on `charges_enabled`. Slack alert if `disabled_reason`
 *   transitions to something that requires vendor action.
 *
 * - **`capability.updated`** — Stripe sends this when a specific
 *   capability (`card_payments`, `transfers`) flips state. We
 *   handle it the same way: re-mirror the account snapshot included
 *   in the event payload. Conceptually redundant with `account.updated`
 *   but Stripe fires both, and ignoring either leaves a stale read.
 *
 * - **`account.application.deauthorized`** — fires when the MC
 *   removes our platform from their account in the Stripe Dashboard.
 *   We clear the binding *without* preserving `last_account_id`
 *   (the MC explicitly cut us off; rebinding silently would be wrong).
 *
 * Idempotency is handled upstream by the `stripe_events` ledger —
 * the platform webhook route inserts the event ID before dispatching
 * here, so we don't worry about replays inside these handlers.
 *
 * @module lib/payments/connect-events
 */
import type Stripe from 'stripe';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts/send-alert';
import {
  type AuthAdmin,
  updateEntitlements,
} from '@/lib/auth/entitlements';
import { createAdminClient } from '@/lib/supabase/admin';

import {
  clearConnectBinding,
  type ConnectAccountSnapshot,
  findUserIdByAccountId,
  syncConnectAccount,
} from './connect-account';

/* ─── Schemas ──────────────────────────────────────────────────── */

/**
 * `account.updated` carries the full {@link Stripe.Account}. We pin
 * only the fields we read so unrelated Stripe API additions don't
 * break parsing.
 */
const accountSchema = z.object({
  id: z.string(),
  charges_enabled: z.boolean().optional().nullable(),
  payouts_enabled: z.boolean().optional().nullable(),
  details_submitted: z.boolean().optional().nullable(),
  default_currency: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  business_type: z.string().optional().nullable(),
  requirements: z
    .object({
      currently_due: z.array(z.string()).optional().nullable(),
      past_due: z.array(z.string()).optional().nullable(),
      disabled_reason: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

/**
 * `capability.updated` carries a `Stripe.Capability` whose `account`
 * field is the parent account ID — but we re-fetch the account via
 * the Stripe API (handled by the caller) before syncing, because
 * the capability object itself doesn't carry the full requirements
 * list we need.
 */
const capabilitySchema = z.object({
  id: z.string(),
  account: z.string(),
  status: z.string().optional().nullable(),
});

/**
 * `account.application.deauthorized` data object is a stripped-down
 * Account (Stripe sends only `id` reliably).
 */
const deauthorizedSchema = z.object({
  id: z.string(),
});

/* ─── Tagged union ─────────────────────────────────────────────── */

export type ParsedConnectEvent =
  | {
      type: 'account.updated';
      data: z.infer<typeof accountSchema>;
    }
  | {
      type: 'capability.updated';
      data: z.infer<typeof capabilitySchema>;
    }
  | {
      type: 'account.application.deauthorized';
      data: z.infer<typeof deauthorizedSchema>;
    };

export const HANDLED_CONNECT_EVENT_TYPES = [
  'account.updated',
  'capability.updated',
  'account.application.deauthorized',
] as const;

export type HandledConnectEventType =
  (typeof HANDLED_CONNECT_EVENT_TYPES)[number];

export interface ParseFailure {
  ok: false;
  issues: { path: string; code: string; message: string }[];
}

export interface ParseSuccess {
  ok: true;
  event: ParsedConnectEvent;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Validate `event.data.object` against the schema for `eventType`.
 * Returns `{ ok: false, ... }` for malformed payloads + unknown
 * event types — the caller logs + alerts + returns 200.
 */
export function parseConnectEvent(
  eventType: string,
  dataObject: unknown,
): ParseResult {
  switch (eventType) {
    case 'account.updated': {
      const parsed = accountSchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    case 'capability.updated': {
      const parsed = capabilitySchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    case 'account.application.deauthorized': {
      const parsed = deauthorizedSchema.safeParse(dataObject);
      if (!parsed.success) return failure(parsed.error);
      return { ok: true, event: { type: eventType, data: parsed.data } };
    }
    default:
      return {
        ok: false,
        issues: [
          {
            path: '_',
            code: 'unhandled_event_type',
            message: `No connect schema registered for "${eventType}"`,
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

/* ─── Dispatch ─────────────────────────────────────────────────── */

/**
 * Dependency-injected Stripe client so unit tests can pass a stub.
 * In production this is the singleton from `lib/payments/stripe.ts`.
 */
export interface StripeForConnect {
  accounts: {
    retrieve: (id: string) => Promise<Stripe.Account>;
  };
}

/**
 * Apply a parsed Connect event to our state.
 *
 * The caller (the platform webhook route) hands us a parsed event
 * plus the platform's Stripe client + auth admin. We:
 * 1. Resolve the user_id from the connected account ID.
 * 2. Run the right side effect.
 * 3. Fire Slack alerts on state transitions that need vendor action.
 *
 * Returns a string describing what happened — used by the webhook
 * route's structured log line. Throws on infra failures so the
 * webhook 500s and Stripe retries.
 */
export async function applyConnectEvent(
  event: ParsedConnectEvent,
  deps: {
    stripe: StripeForConnect;
    authAdmin: AuthAdmin;
  },
): Promise<string> {
  switch (event.type) {
    case 'account.updated':
      return applyAccountUpdated(event.data, deps);
    case 'capability.updated':
      return applyCapabilityUpdated(event.data, deps);
    case 'account.application.deauthorized':
      return applyDeauthorized(event.data, deps);
  }
}

async function applyAccountUpdated(
  account: z.infer<typeof accountSchema>,
  deps: { authAdmin: AuthAdmin },
): Promise<string> {
  const userId = await findUserIdByAccountId(account.id);
  if (!userId) {
    // Tail event for an account we've since deauthorized — log + ack.
    return `account.updated for unknown account ${account.id} (no-op)`;
  }

  await syncConnectAccount(userId, snapshotFromZ(account));

  // Flip the cheap-read entitlement so the invoice-payment route's
  // `stripeConnectEnabled(user)` reflects `charges_enabled` without
  // reading the mirror table.
  await updateEntitlements(deps.authAdmin, userId, {
    stripe_connect_account_id: account.id,
    stripe_connect_enabled: Boolean(account.charges_enabled),
  });

  // Slack-alert on state transitions that require vendor action:
  // a non-null `disabled_reason` means Stripe has paused some
  // capability (commonly `requirements.past_due` after a missed
  // verification window). The MC needs to know.
  const disabledReason = account.requirements?.disabled_reason ?? null;
  if (disabledReason) {
    await sendAlert({
      type: 'stripe_connect_disabled',
      severity: 'warn',
      userId,
      accountId: account.id,
      disabledReason,
      currentlyDue: account.requirements?.currently_due ?? [],
      pastDue: account.requirements?.past_due ?? [],
    });
  }

  return `account.updated synced for user ${userId} (charges_enabled=${
    account.charges_enabled ? 'true' : 'false'
  })`;
}

async function applyCapabilityUpdated(
  capability: z.infer<typeof capabilitySchema>,
  deps: { stripe: StripeForConnect; authAdmin: AuthAdmin },
): Promise<string> {
  // The capability event payload doesn't carry the full requirements
  // list we want — re-fetch the account so the mirror stays consistent.
  // (The `account.updated` event is usually sent alongside this, but
  // we don't rely on ordering — running both handlers is idempotent.)
  const account = await deps.stripe.accounts.retrieve(capability.account);
  return applyAccountUpdated(
    accountSchema.parse(account),
    { authAdmin: deps.authAdmin },
  );
}

async function applyDeauthorized(
  account: z.infer<typeof deauthorizedSchema>,
  deps: { authAdmin: AuthAdmin },
): Promise<string> {
  const userId = await findUserIdByAccountId(account.id);
  if (!userId) {
    return `deauthorized for unknown account ${account.id} (no-op)`;
  }

  // Vendor explicitly removed our platform — don't preserve the
  // account ID for silent re-bind. The MC has to start fresh next
  // time.
  await clearConnectBinding(userId);
  await updateEntitlements(deps.authAdmin, userId, {
    stripe_connect_account_id: undefined,
    stripe_connect_enabled: false,
  });

  await sendAlert({
    type: 'stripe_connect_deauthorized',
    severity: 'warn',
    userId,
    accountId: account.id,
  });

  return `deauthorized cleared for user ${userId}`;
}

/* ─── Helpers ──────────────────────────────────────────────────── */

/**
 * Coerce a Zod-parsed account into the {@link ConnectAccountSnapshot}
 * shape. The two types are intentionally close but not identical —
 * the snapshot interface lives in `connect-account.ts` so it doesn't
 * depend on Zod, and it carries `Stripe.Account.BusinessType` for
 * the persistence layer's column type. The Zod schema accepts a
 * looser `string` for `business_type` (Stripe sends `null | string`
 * but the SDK types narrow to the enum) — the cast here is safe
 * because we never trust this column for an enum-like check; it's
 * informational on the status panel.
 */
function snapshotFromZ(
  parsed: z.infer<typeof accountSchema>,
): ConnectAccountSnapshot {
  return {
    id: parsed.id,
    charges_enabled: parsed.charges_enabled ?? null,
    payouts_enabled: parsed.payouts_enabled ?? null,
    details_submitted: parsed.details_submitted ?? null,
    default_currency: parsed.default_currency ?? null,
    country: parsed.country ?? null,
    business_type: (parsed.business_type ?? null) as
      | Stripe.Account.BusinessType
      | null,
    requirements: parsed.requirements
      ? {
          currently_due: parsed.requirements.currently_due ?? null,
          past_due: parsed.requirements.past_due ?? null,
          disabled_reason: parsed.requirements.disabled_reason ?? null,
        }
      : null,
  };
}

/**
 * For DI in handlers that need to look up the admin client without
 * threading it through every call. Mirrors `webhook-events.ts`
 * convention.
 */
export function defaultAuthAdmin(): AuthAdmin {
  return createAdminClient().auth.admin as unknown as AuthAdmin;
}
