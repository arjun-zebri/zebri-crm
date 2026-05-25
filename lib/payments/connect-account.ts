/**
 * Stripe Connect account mirror — server-side helpers that read /
 * write the `connect_accounts` table.
 *
 * The webhook handler for `account.updated` / `capability.updated` /
 * `account.application.deauthorized` calls into this module after
 * the Zod parse in {@link parseConnectEvent}. The MC-facing settings
 * page reads the mirror row via `entitlements.connectAccount(user)`.
 *
 * Two invariants this module enforces:
 *
 * 1. **Stripe is the only source of truth** for account state. We
 *    never *update* a field based on something the user typed in
 *    Zebri — `syncConnectAccount` either writes a fresh snapshot
 *    from a Stripe.Account or returns early. The MC's UI mutates
 *    the Stripe account directly via the embedded Connect components;
 *    the resulting `account.updated` webhook is what writes our row.
 *
 * 2. **Disconnect ≠ delete.** Clearing the binding in
 *    `connect_accounts` is done by {@link clearConnectBinding}; it
 *    moves `account_id` → `last_account_id` so a future re-connect
 *    can re-bind the same Stripe account instead of creating a brand-
 *    new one. Stripe doesn't expose programmatic account deletion
 *    for Express accounts — the only way to fully remove is the
 *    Stripe Dashboard, and we shouldn't pretend to "delete" something
 *    we can't.
 *
 * Both functions use the service-role admin client (the rows aren't
 * INSERT/UPDATE-able under RLS — see the
 * `20260524000000_create_connect_accounts.sql` migration).
 *
 * @module lib/payments/connect-account
 */
import type Stripe from 'stripe';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Subset of `Stripe.Account` that the mirror writes. Defined as a
 * structural type rather than a re-export of `Stripe.Account` so
 * tests can hand-roll fixtures without instantiating the full Stripe
 * type tree (which has hundreds of nullable nested objects).
 */
export interface ConnectAccountSnapshot {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  default_currency?: string | null;
  country?: string | null;
  business_type?: Stripe.Account.BusinessType | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
}

/**
 * Mirror a Stripe Account snapshot into the `connect_accounts` row
 * for the given user.
 *
 * Idempotent — re-running with the same snapshot yields the same
 * row (the `updated_at` trigger bumps the timestamp but otherwise
 * no-op). Safe to call from a webhook retry path.
 *
 * Uses `upsert` keyed on `user_id` so the first call for a new MC
 * inserts the row and subsequent calls update it.
 *
 * @returns The persisted row's account_id, or null if the snapshot
 *          had no `id` (defensive — Stripe always sets it but the
 *          type allows undefined).
 */
export async function syncConnectAccount(
  userId: string,
  snapshot: ConnectAccountSnapshot,
): Promise<string | null> {
  if (!snapshot.id) return null;
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    account_id: snapshot.id,
    charges_enabled: snapshot.charges_enabled ?? false,
    payouts_enabled: snapshot.payouts_enabled ?? false,
    details_submitted: snapshot.details_submitted ?? false,
    requirements_currently_due: snapshot.requirements?.currently_due ?? [],
    requirements_past_due: snapshot.requirements?.past_due ?? [],
    disabled_reason: snapshot.requirements?.disabled_reason ?? null,
    default_currency: snapshot.default_currency ?? null,
    country: snapshot.country ?? null,
    business_type: snapshot.business_type ?? null,
    // Clear last_account_id on a successful sync — the binding is
    // live again, so the "previous" slot is no longer meaningful.
    last_account_id: null,
  };
  const { error } = await admin
    .from('connect_accounts')
    .upsert(row, { onConflict: 'user_id' });
  if (error) throw new Error(`connect_accounts upsert failed: ${error.message}`);
  return snapshot.id;
}

/**
 * Disconnect path — moves the live `account_id` to `last_account_id`
 * and zeroes the capability flags. The Stripe account itself isn't
 * touched; if the MC re-connects later, the new onboarding flow can
 * pre-fill from `last_account_id` to avoid creating a duplicate.
 *
 * Called from:
 * - The disconnect server action (`/api/stripe/connect/disconnect`).
 * - The `account.application.deauthorized` webhook (in that case
 *   we also clear `last_account_id` — see {@link handleDeauthorized}
 *   in connect-events.ts — because the MC explicitly removed our
 *   platform's access and we shouldn't try to rebind silently).
 */
export async function clearConnectBinding(
  userId: string,
  opts: { preserveLastAccountId: boolean },
): Promise<void> {
  const admin = createAdminClient();
  // Read current account_id so we can move it to last_account_id.
  const { data: existing, error: readErr } = await admin
    .from('connect_accounts')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`connect_accounts read failed: ${readErr.message}`);
  }
  const previousAccountId = existing?.account_id ?? null;

  const { error } = await admin
    .from('connect_accounts')
    .upsert(
      {
        user_id: userId,
        account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements_currently_due: [],
        requirements_past_due: [],
        disabled_reason: null,
        last_account_id: opts.preserveLastAccountId ? previousAccountId : null,
      },
      { onConflict: 'user_id' },
    );
  if (error) {
    throw new Error(`connect_accounts clear failed: ${error.message}`);
  }
}

/**
 * Hard-delete the mirror row for a user. Used by the disconnect
 * server action when we want a true reset (no `last_account_id`
 * preserved). Distinct from {@link clearConnectBinding} which keeps
 * the row but zeroes the fields.
 *
 * Why both? Most disconnects can leave the row in place — the
 * unique constraint on `account_id` is nullable so this isn't
 * required for correctness. But a full delete is the only way to
 * guarantee a re-kickoff creates a brand-new Stripe account
 * (instead of rebinding to a stale `last_account_id`), so we use
 * this from the disconnect route. The `account.application.deauthorized`
 * webhook also uses this when the vendor cuts the platform off
 * outright.
 */
export async function deleteConnectBinding(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('connect_accounts')
    .delete()
    .eq('user_id', userId);
  if (error) {
    throw new Error(`connect_accounts delete failed: ${error.message}`);
  }
}

/**
 * Look up the user_id that owns a given Stripe account ID. Used by
 * the webhook handler — Stripe events identify the Connect account
 * via `event.account` (the platform receives the event on behalf of
 * the connected account), and we need to find the matching Zebri
 * user to write entitlements + alert against.
 *
 * Returns null if no mirror row exists yet (e.g. a stray event for
 * an account we've since deauthorized — the row's gone but Stripe
 * may still send tail events for a short period).
 */
export async function findUserIdByAccountId(
  accountId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('connect_accounts')
    .select('user_id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`connect_accounts lookup failed: ${error.message}`);
  }
  return data?.user_id ?? null;
}

/* ─── Reader (UI + server-side detail reads) ───────────────────── */

/**
 * Shape returned by {@link readConnectAccount}. Mirrors the table
 * columns we surface to UI / server callers. Nullable fields stay
 * nullable.
 */
export interface ConnectAccountState {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
  disabledReason: string | null;
  defaultCurrency: string | null;
  country: string | null;
  businessType: string | null;
  /** Previous account ID kept after a server-initiated disconnect.
   *  Used to offer a "re-link your previous account" affordance. */
  lastAccountId: string | null;
}

/**
 * Read the Connect account state for a given user. Returns null if
 * no row exists (i.e. the MC has never connected).
 *
 * UI components should read this via the route-handler / RSC server
 * boundary rather than calling Supabase directly, so the mirror's
 * shape stays encapsulated.
 */
export async function readConnectAccount(
  userId: string,
): Promise<ConnectAccountState | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('connect_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(`connect_accounts read failed: ${error.message}`);
  }
  if (!data) return null;
  return {
    accountId: data.account_id,
    chargesEnabled: data.charges_enabled,
    payoutsEnabled: data.payouts_enabled,
    detailsSubmitted: data.details_submitted,
    requirementsCurrentlyDue: toStringArray(data.requirements_currently_due),
    requirementsPastDue: toStringArray(data.requirements_past_due),
    disabledReason: data.disabled_reason,
    defaultCurrency: data.default_currency,
    country: data.country,
    businessType: data.business_type,
    lastAccountId: data.last_account_id,
  };
}

/**
 * `requirements_currently_due` / `past_due` are stored as jsonb so
 * Stripe can add new requirement types without a schema change.
 * Defensively coerce to `string[]` for callers.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return [];
}
