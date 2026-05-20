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
 * Read model — "migrated user" sentinel:
 *   1. If `app_metadata.account_type` is set, the user has been
 *      backfilled. From that point on `app_metadata` is the SOLE
 *      source of truth for ALL entitlement reads — `user_metadata`
 *      is ignored entirely so an attacker can't grant themselves a
 *      single field that the backfill didn't set yet (e.g. a future
 *      `stripe_connect_account_id`).
 *   2. If `app_metadata.account_type` is missing, the user is
 *      pre-migration — fall back to `user_metadata` so live
 *      sessions don't lose admin / paid access in the deploy gap
 *      before the backfill migration runs. The 0.8b backfill sets
 *      `account_type` for every existing user, so after the
 *      migration completes this branch becomes dead code (a
 *      follow-up cleanup removes the fallback entirely once 24-48h
 *      of JWT-refresh soak has passed).
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
 * "Has this user been migrated to app_metadata?" — the backfill sets
 * `app_metadata.account_type` for every user, so its presence is
 * the sentinel. Once true, `user_metadata` is ignored entirely for
 * entitlement reads, blocking the §7.4 escalation paths.
 */
function isMigrated(source: EntitlementSource | null | undefined): boolean {
  const v = source?.app_metadata?.account_type;
  return v !== undefined && v !== null;
}

/**
 * Read a single entitlement field.
 *
 * - If the source has been migrated, `app_metadata` is authoritative —
 *   `user_metadata` is NEVER consulted (no escalation).
 * - If not yet migrated, fall back to `user_metadata` so live
 *   sessions keep working in the deploy gap before the backfill.
 */
function read<T>(source: EntitlementSource | null | undefined, key: string): T | undefined {
  if (!source) return undefined;
  const fromApp = source.app_metadata?.[key];
  if (fromApp !== undefined && fromApp !== null) return fromApp as T;
  if (isMigrated(source)) return undefined; // app_metadata wins; do NOT fall back.
  const fromUser = source.user_metadata?.[key];
  if (fromUser !== undefined && fromUser !== null) return fromUser as T;
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
  // (e.g. comping a user clears stripe_subscription_id). The
  // {@link ServerManagedEntitlements} interface documents the canonical
  // shape; deliberate widening here so callers don't have to wrestle the
  // type system to clear a field.
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error: getErr } = await admin.getUserById(userId);
  if (getErr) throw getErr;
  const existing = (data.user?.app_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.updateUserById(userId, {
    app_metadata: { ...existing, ...patch },
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
