/**
 * Entitlement reads — the single source of truth for "is this user
 * allowed to do X?" decisions in app code and middleware.
 *
 * Phase 0.8b moved every entitlement field (admin/subscription/Stripe
 * identity/Connect) out of user-writable `user_metadata` into
 * server-only-writable `app_metadata`. The §7.4 finding: any read
 * that trusts `user_metadata` for a security decision lets a user
 * self-escalate by calling `supabase.auth.updateUser({ data: {…} })`.
 *
 * **Phase 1 (2026-05-21):** the transitional `user_metadata` fallback
 * was removed. Every existing user has been migrated for days; new
 * users go through the signup server action which writes
 * `app_metadata` directly via {@link updateEntitlements} plus the
 * `sync_signup_app_metadata_on_insert` trigger as defence in depth.
 * `app_metadata` is now the SOLE source of truth — no fallback,
 * ever. Tightens the §7.4 fix by removing the transitional escape
 * hatch.
 *
 * Tests in `tests/unit/lib/auth/entitlements.test.ts` pin the
 * escalation blocks. Integration tests assert end-to-end.
 *
 * @module lib/auth/entitlements
 */

export type PlanId = 'starter' | 'pro' | 'max';
export type AccountType = 'vendor' | 'admin';

/**
 * Anything shaped like a Supabase {@link User} — having both
 * `app_metadata` (server-only) and `user_metadata` (user-writable)
 * jsonb bags. We accept the minimal shape so this module doesn't
 * pull `@supabase/supabase-js` types into the bundle.
 */
export interface EntitlementSource {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Read a single entitlement field from `app_metadata` only.
 *
 * `user_metadata` is **never** consulted — even if `app_metadata` is
 * missing the requested key. This is the §7.4 invariant: an
 * attacker writing `subscription_status: 'active'` to
 * `user_metadata` via `auth.updateUser({ data })` cannot grant
 * themselves paid access, because this helper never looks there.
 *
 * Pre-Phase 1 there was a transitional fallback to `user_metadata`
 * for unmigrated users; the backfill migration + INSERT trigger
 * (Phase 0.8b) and the signup server action (Phase 1) guarantee
 * `app_metadata` is populated for every user.
 */
function read<T>(source: EntitlementSource | null | undefined, key: string): T | undefined {
  if (!source) return undefined;
  const v = source.app_metadata?.[key];
  if (v !== undefined && v !== null) return v as T;
  return undefined;
}

/* ────────────────────────────────────────────────────────────────
   Account type / admin role
─────────────────────────────────────────────────────────────────── */

export function accountType(source: EntitlementSource | null | undefined): AccountType {
  return read<string>(source, 'account_type') === 'admin' ? 'admin' : 'vendor';
}

export function isAdmin(source: EntitlementSource | null | undefined): boolean {
  return accountType(source) === 'admin';
}

/* ────────────────────────────────────────────────────────────────
   Subscription + paywall
─────────────────────────────────────────────────────────────────── */

export function subscriptionStatus(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'subscription_status');
}

export function subscriptionPlan(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'subscription_plan');
}

export function isSubscribed(source: EntitlementSource | null | undefined): boolean {
  return read<boolean>(source, 'is_subscribed') === true;
}

export function trialEnd(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'trial_end');
}

export function subscriptionEnd(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'subscription_end');
}

export function isBetaUser(source: EntitlementSource | null | undefined): boolean {
  return read<boolean>(source, 'is_beta_user') === true;
}

/** True when the subscription is currently honouring paid access. */
export function isActive(source: EntitlementSource | null | undefined): boolean {
  const s = subscriptionStatus(source);
  return s === 'trialing' || s === 'active';
}

/** The plan the user effectively has right now (starter if inactive). */
export function currentPlan(source: EntitlementSource | null | undefined): PlanId {
  if (!isActive(source)) return 'starter';
  const p = subscriptionPlan(source);
  if (p === 'pro' || p === 'max') return p;
  return 'starter';
}

export function hasContractsAccess(source: EntitlementSource | null | undefined): boolean {
  const plan = currentPlan(source);
  return plan === 'pro' || plan === 'max';
}

/* ────────────────────────────────────────────────────────────────
   Stripe billing + Connect identities
─────────────────────────────────────────────────────────────────── */

export function stripeCustomerId(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'stripe_customer_id');
}

export function stripeSubscriptionId(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'stripe_subscription_id');
}

export function stripeConnectAccountId(source: EntitlementSource | null | undefined): string | undefined {
  return read<string>(source, 'stripe_connect_account_id');
}

export function stripeConnectEnabled(source: EntitlementSource | null | undefined): boolean {
  return read<boolean>(source, 'stripe_connect_enabled') === true;
}

/* ────────────────────────────────────────────────────────────────
   The canonical "fields we manage server-side" set — used by the
   signup flow + Stripe webhook + admin actions when WRITING into
   app_metadata so the shape stays consistent.
─────────────────────────────────────────────────────────────────── */

export interface ServerManagedEntitlements {
  account_type?: AccountType;
  subscription_status?: string;
  subscription_plan?: string;
  is_subscribed?: boolean;
  trial_end?: string;
  subscription_end?: string;
  is_beta_user?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_connect_account_id?: string;
  stripe_connect_enabled?: boolean;
}

/* ────────────────────────────────────────────────────────────────
   Write helper — merges entitlement fields into app_metadata
─────────────────────────────────────────────────────────────────── */

/** Minimal shape of `supabase.auth.admin` we need for the helper. */
export interface AuthAdmin {
  getUserById: (id: string) => Promise<{
    data: { user: EntitlementSource | null };
    error: unknown;
  }>;
  updateUserById: (
    id: string,
    attrs: { app_metadata?: Record<string, unknown> },
  ) => Promise<{ data: unknown; error: unknown }>;
}

/**
 * Update a user's server-managed entitlement fields. Reads the
 * current `app_metadata`, merges the patch on top, and writes back
 * via the admin API. Never writes to `user_metadata` (that's the
 * §7.4 escalation surface).
 *
 * @example
 * ```ts
 * await updateEntitlements(adminClient.auth.admin, userId, {
 *   subscription_status: 'active',
 *   subscription_plan: 'pro',
 * });
 * ```
 */
export async function updateEntitlements(
  admin: AuthAdmin,
  userId: string,
  // `Record<string, unknown>` instead of `ServerManagedEntitlements` keeps
  // call sites ergonomic under `exactOptionalPropertyTypes` — explicit
  // `field: undefined` patches are common when clearing entitlement state
  // (e.g. resuming a subscription clears `subscription_end`). The
  // {@link ServerManagedEntitlements} interface documents the canonical
  // shape; deliberate widening here so callers don't have to wrestle the
  // type system to clear a field.
  //
  // Clearing semantics: a patch entry with value `undefined` or `null`
  // **deletes** the corresponding key from `app_metadata` rather than
  // leaving the existing value in place. JSON serialisation strips
  // `undefined` keys, so the naive `{ ...existing, ...patch }` merge
  // wouldn't actually clear them — we explicitly delete here so callers
  // can write `field: undefined` to mean "clear this field".
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error: getErr } = await admin.getUserById(userId);
  if (getErr) throw getErr;
  const existing = (data.user?.app_metadata ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing, ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined || patch[key] === null) delete merged[key];
  }
  const { error } = await admin.updateUserById(userId, {
    app_metadata: merged,
  });
  if (error) throw error;
}

/** Keys that must NEVER be set via `auth.updateUser({ data })`. */
export const SERVER_MANAGED_KEYS = [
  'account_type',
  'subscription_status',
  'subscription_plan',
  'is_subscribed',
  'trial_end',
  'subscription_end',
  'is_beta_user',
  'stripe_customer_id',
  'stripe_subscription_id',
  'stripe_connect_account_id',
  'stripe_connect_enabled',
] as const;
