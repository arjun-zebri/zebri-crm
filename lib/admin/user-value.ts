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
  /**
   * ISO timestamp of this user's most recent write across the
   * activity surfaces (couple / event / invoice / contract), or null
   * if they have never written anything.
   *
   * This — not `AdminUser.last_sign_in_at` — is the admin dashboard's
   * "are they still using Zebri?" signal. See
   * {@link computeGoneQuiet} for why.
   */
  lastActiveAt: string | null;
}

/** All-zero stats for users with no rows in any activity table. */
export function emptyUserStats(): UserStats {
  return {
    couples: 0,
    events: 0,
    invoices: 0,
    paidTotal: 0,
    templates: 0,
    automations: 0,
    lastActiveAt: null,
  };
}

/**
 * This user's last-activity timestamp in epoch ms, or 0 when they
 * have never been active (or have no stats row at all, which means
 * the same thing: no rows in any activity table).
 */
function lastActiveMs(stats: Record<string, UserStats>, userId: string): number {
  const iso = stats[userId]?.lastActiveAt;
  return iso ? new Date(iso).getTime() : 0;
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
 * activity (never-active last), then newest signup as a stable
 * tiebreak.
 *
 * Returns a comparator rather than being one, because the activity
 * timestamp lives in the stats map keyed by user id, not on
 * `AdminUser` itself.
 *
 * @param stats - per-user stats from `getAllUserStats()`.
 */
export function byPlanThenActivity(
  stats: Record<string, UserStats>,
): (a: AdminUser, b: AdminUser) => number {
  return (a, b) => {
    const tier = planRank(a) - planRank(b);
    if (tier !== 0) return tier;
    const aActive = lastActiveMs(stats, a.id);
    const bActive = lastActiveMs(stats, b.id);
    if (aActive !== bActive) return bActive - aActive;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  };
}

export interface GoneQuietUser {
  id: string;
  email: string;
  business_name: string;
  plan: "max" | "pro" | "starter";
  is_comped: boolean;
  /** Null = never wrote anything at all. */
  lastActiveAt: string | null;
  /** Whole days since the last write; null when they were never active. */
  daysSinceActive: number | null;
}

/** Days without activity before a paying user counts as "gone quiet". */
const GONE_QUIET_DAYS = 14;

/**
 * Paying or comped users with no activity for 14+ days — revenue at
 * risk. Distinct from dormant (dormant = never started; gone quiet =
 * was in, stopped coming back). Highest tier first so the most
 * valuable at-risk accounts surface at the top.
 *
 * Activity means a **write** (their most recent couple / event /
 * invoice / contract), deliberately *not* `last_sign_in_at`. GoTrue
 * only stamps `last_sign_in_at` when credentials are actually
 * exchanged; a refresh-token rotation leaves it untouched. Zebri sets
 * neither `timebox` nor `inactivity_timeout` on sessions, so a user
 * who logged in once never re-authenticates and their sign-in
 * timestamp freezes at their first-ever login. Reading it as an
 * activity signal filled this list with the healthiest long-lived
 * accounts. It also removes the old shadow-mode caveat: shadowing a
 * user signs them in via OTP, which used to make them look falsely
 * active here.
 *
 * The tradeoff: a user who only ever *reads* (checking their calendar,
 * say) writes nothing and will surface as gone quiet.
 *
 * @param users - every user from `listUsersWithSubscription()`.
 * @param stats - per-user stats from `getAllUserStats()`; a missing
 *   entry counts as never active.
 * @param now - clock reading in epoch ms.
 */
export function computeGoneQuiet(
  users: AdminUser[],
  stats: Record<string, UserStats>,
  now: number,
): GoneQuietUser[] {
  const cutoff = now - GONE_QUIET_DAYS * MS_PER_DAY;
  return users
    .filter((u) => {
      if (!isPayingActive(u) && !u.is_comped) return false;
      const active = lastActiveMs(stats, u.id);
      if (!active) return true;
      return active < cutoff;
    })
    .sort(byPlanThenActivity(stats))
    .map((u) => {
      const lastActiveAt = stats[u.id]?.lastActiveAt ?? null;
      return {
        id: u.id,
        email: u.email,
        business_name: u.business_name,
        plan: effectivePlan(u),
        is_comped: u.is_comped,
        lastActiveAt,
        daysSinceActive: lastActiveAt
          ? Math.floor((now - new Date(lastActiveAt).getTime()) / MS_PER_DAY)
          : null,
      };
    });
}
