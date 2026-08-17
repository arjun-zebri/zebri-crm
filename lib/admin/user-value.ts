/**
 * Pure per-user value/tier helpers shared by the admin UI (client
 * components) and the server-side aggregators.
 *
 * Kept separate from `admin-analytics.ts` on purpose: that module
 * constructs a service-role Supabase client, so importing it at
 * runtime from a `'use client'` file would drag the service-role
 * code path into the browser bundle. Everything here is pure and
 * bundle-safe.
 *
 * @module lib/admin/user-value
 */
import type { AdminUser } from "./admin-analytics";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How much value a user gets from Zebri, as countable facts. Rendered
 * as columns on the admin Users table; `paidTotal` is the strongest
 * signal (real dollars couples paid through the platform).
 */
export interface UserStats {
  couples: number;
  events: number;
  invoices: number;
  /** $ collected — sum of `invoiceTotal()` over invoices with `paid_at` set. */
  paidTotal: number;
  /** Combined count across every template type (email / contract / invoice / questionnaire / package). */
  templates: number;
  automations: number;
}

/** All-zero stats for users with no rows in any activity table. */
export function emptyUserStats(): UserStats {
  return { couples: 0, events: 0, invoices: 0, paidTotal: 0, templates: 0, automations: 0 };
}

/**
 * A user who actually pays money right now: active subscription with
 * a real Stripe subscription behind it. Comped and beta users are
 * deliberately excluded — they get the product free, so they don't
 * count toward MRR/churn.
 */
export function isPayingActive(u: AdminUser): boolean {
  return (
    u.subscription_status === "active" &&
    !u.is_comped &&
    !u.is_beta_user &&
    !!u.stripe_subscription_id &&
    !!u.subscription_plan
  );
}

/**
 * The plan the user is effectively on TODAY — matches what the Users
 * table displays: a cancelled ex-Pro shows (and sorts) as Starter.
 * Comped users keep their granted plan (status is 'active' for them).
 */
export function effectivePlan(
  u: Pick<AdminUser, "subscription_status" | "subscription_plan">,
): "max" | "pro" | "starter" {
  return u.subscription_status === "active" && u.subscription_plan
    ? u.subscription_plan
    : "starter";
}

const PLAN_RANK: Record<"max" | "pro" | "starter", number> = { max: 0, pro: 1, starter: 2 };

/** Sort key: max first, then pro, then starter. */
export function planRank(
  u: Pick<AdminUser, "subscription_status" | "subscription_plan">,
): number {
  return PLAN_RANK[effectivePlan(u)];
}

/**
 * Default Users-table order: highest tier first, then most recent
 * sign-in (never-signed-in last), then newest signup as a stable
 * tiebreak.
 */
export function compareUsersByPlanThenSignIn(a: AdminUser, b: AdminUser): number {
  const tier = planRank(a) - planRank(b);
  if (tier !== 0) return tier;
  const aSignIn = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
  const bSignIn = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
  if (aSignIn !== bSignIn) return bSignIn - aSignIn;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export interface GoneQuietUser {
  id: string;
  email: string;
  business_name: string;
  plan: "max" | "pro" | "starter";
  is_comped: boolean;
  /** Null = never signed in at all. */
  last_sign_in_at: string | null;
  /** Whole days since the last sign-in; null when they never signed in. */
  daysSinceSignIn: number | null;
}

/** Days without a sign-in before a paying user counts as "gone quiet". */
const GONE_QUIET_DAYS = 14;

/**
 * Paying or comped users who haven't signed in for 14+ days —
 * revenue at risk. Distinct from dormant (dormant = never started;
 * gone quiet = was in, stopped coming back). Highest tier first so
 * the most valuable at-risk accounts surface at the top.
 *
 * Caveat: entering shadow mode signs the admin in AS the user via
 * OTP, which refreshes their `last_sign_in_at` — a recently-shadowed
 * user can look falsely active for a while.
 */
export function computeGoneQuiet(users: AdminUser[], now: number): GoneQuietUser[] {
  const cutoff = now - GONE_QUIET_DAYS * MS_PER_DAY;
  return users
    .filter((u) => {
      if (!isPayingActive(u) && !u.is_comped) return false;
      if (!u.last_sign_in_at) return true;
      return new Date(u.last_sign_in_at).getTime() < cutoff;
    })
    .sort(compareUsersByPlanThenSignIn)
    .map((u) => ({
      id: u.id,
      email: u.email,
      business_name: u.business_name,
      plan: effectivePlan(u),
      is_comped: u.is_comped,
      last_sign_in_at: u.last_sign_in_at,
      daysSinceSignIn: u.last_sign_in_at
        ? Math.floor((now - new Date(u.last_sign_in_at).getTime()) / MS_PER_DAY)
        : null,
    }));
}
