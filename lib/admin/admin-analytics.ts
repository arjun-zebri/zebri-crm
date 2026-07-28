/**
 * Admin analytics — server-side aggregators feeding the single-pane
 * /admin dashboard. All queries run with the service role; the route
 * is gated by `isAdmin()` at the middleware + page layer.
 *
 * Shape is driven by what the founder actually needs to see at a
 * glance (Phase 13.1 redesign): MRR (with plan breakdown), churn
 * rate, upcoming renewals, active subscriber counts (not conflated
 * with free-Starter users), engagement (are people actually using
 * the product?), and a weekly signups chart.
 *
 * @module lib/admin/admin-analytics
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

function adminClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const PLAN_PRICE: Record<string, number> = { pro: 49, max: 89 };

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  business_name: string;
  account_type: "vendor" | "admin";
  subscription_status: SubscriptionStatus | null;
  subscription_plan: "pro" | "max" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  subscription_end: string | null;
  cancel_at_period_end: boolean;
  is_subscribed: boolean;
  is_beta_user: boolean;
  is_comped: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export async function listUsersWithSubscription(): Promise<AdminUser[]> {
  const admin = adminClient();
  const all: AdminUser[] = [];
  // Paginate beyond the 1000-row API cap so MRR / counts don't silently
  // truncate as the platform grows.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users ?? [];
    for (const u of users) {
      // Read entitlement fields from app_metadata only (§7.4) but
      // display fields from user_metadata. The auth admin SDK returns
      // both bags on every user.
      const am = (u.app_metadata ?? {}) as Record<string, unknown>;
      const um = u.user_metadata ?? {};
      all.push({
        id: u.id,
        email: u.email ?? "",
        display_name: (um.display_name as string) ?? "",
        business_name: (um.business_name as string) ?? "",
        account_type: ((am.account_type as string) ?? "vendor") as "vendor" | "admin",
        subscription_status: (am.subscription_status as SubscriptionStatus) ?? null,
        subscription_plan: (am.subscription_plan as "pro" | "max" | null) ?? null,
        stripe_customer_id: (am.stripe_customer_id as string) ?? null,
        stripe_subscription_id: (am.stripe_subscription_id as string) ?? null,
        trial_end: (am.trial_end as string) ?? null,
        subscription_end: (am.subscription_end as string) ?? null,
        cancel_at_period_end: Boolean(am.cancel_at_period_end),
        is_subscribed: Boolean(am.is_subscribed),
        is_beta_user: Boolean(am.is_beta_user),
        is_comped: Boolean(am.is_comped),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (users.length < 1000) break;
    page++;
  }
  return all;
}

export interface UserAnalytics {
  couples: number;
  events: number;
  invoices: number;
  contracts: number;
  lastSignInAt: string | null;
}

/** Per-user activity counts for the detail panel. */
export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  const admin = adminClient();

  const [couples, events, invoices, contracts, userRes] = await Promise.all([
    admin.from("couples").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("events").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("contracts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.auth.admin.getUserById(userId),
  ]);

  return {
    couples: couples.count ?? 0,
    events: events.count ?? 0,
    invoices: invoices.count ?? 0,
    contracts: contracts.count ?? 0,
    lastSignInAt: userRes.data.user?.last_sign_in_at ?? null,
  };
}

// ── Dashboard-shape aggregator ────────────────────────────────────

export interface MrrBreakdown {
  /** Total MRR — sum of plan prices for active paying users. */
  total: number;
  /** Per-plan revenue. */
  pro: number;
  max: number;
  /** Counts contributing to each plan. */
  proCount: number;
  maxCount: number;
}

export interface SubscriberCounts {
  /** All-time signups. */
  total: number;
  /** Active paying (excludes comped + beta). */
  paying: number;
  /** is_comped = true. */
  comped: number;
  /** subscription_status = 'past_due'. */
  pastDue: number;
  /** Cancelled and no future access (sub_end in the past). */
  cancelled: number;
  /** Free Starter — never paid (no Stripe subscription on file). */
  freeStarter: number;
}

export interface ChurnSummary {
  /** Cancellations whose subscription_end falls in [now - 30d, now]. */
  cancelledLast30d: number;
  /** Active paying users right now. */
  activeNow: number;
  /** Approx monthly churn rate = cancelledLast30d / (activeNow + cancelledLast30d). */
  monthlyRate: number;
  /** Users with cancel_at_period_end = true (will churn at period end). */
  pendingCancellations: number;
}

export interface UpcomingRenewal {
  userId: string;
  email: string;
  business_name: string;
  plan: "pro" | "max" | null;
  amount: number;
  subscription_end: string;
  daysUntil: number;
  cancel_at_period_end: boolean;
}

export interface UpcomingRenewals {
  /** Renewals in the next 7 days. */
  next7d: UpcomingRenewal[];
  /** Renewals in the next 30 days (includes next7d as a subset). */
  next30d: UpcomingRenewal[];
  /** Total $ value of next-30d renewals. */
  next30dValue: number;
}

export interface EngagementSummary {
  /** Distinct user_ids that wrote a couple / event / invoice / contract / quote in the last 30 days. */
  activeLast30d: number;
  /** Signed-up > 30 days ago AND have zero couples in any table — never engaged. */
  dormantAccounts: number;
  /** Brand-new users (last 7 days). */
  newThisWeek: number;
}

export interface SignupsChartPoint {
  /** ISO week-start date for the bucket. */
  weekStart: string;
  /** Display label, e.g. "May 27". */
  label: string;
  /** New signups during this week. */
  count: number;
}

export interface MetricSeriesPoint {
  weekStart: string;
  label: string;
  value: number;
}

export interface MetricSeries {
  /** Current (rightmost) value — also drives the hero card number. */
  current: number;
  /** Previous-period value (one bucket before current). */
  previous: number;
  /** Percentage diff vs previous. 0 if previous is 0. */
  percentChange: number;
  /** 12 weekly buckets, oldest first. */
  points: MetricSeriesPoint[];
}

export interface RecentSignup {
  id: string;
  email: string;
  display_name: string;
  business_name: string;
  created_at: string;
}

export interface PastDueUser {
  id: string;
  email: string;
  business_name: string;
  subscription_plan: "pro" | "max" | null;
  stripe_customer_id: string | null;
}

export interface ConnectIssue {
  user_id: string;
  account_id: string | null;
  disabled_reason: string | null;
  requirements_past_due: string[];
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

export interface DormantUser {
  id: string;
  email: string;
  business_name: string;
  created_at: string;
  daysSinceSignup: number;
}

export interface AdminDashboard {
  mrr: MrrBreakdown;
  subscribers: SubscriberCounts;
  churn: ChurnSummary;
  renewals: UpcomingRenewals;
  engagement: EngagementSummary;
  /** 4 hero metric series — each shown as a chart card. */
  series: {
    mrr: MetricSeries;
    activeSubs: MetricSeries;
    churnRate: MetricSeries;
    signups: MetricSeries;
  };
  /** Legacy single-series shape kept for the chart that already
   *  consumed it; the same data lives in `series.signups.points`. */
  signupsChart: SignupsChartPoint[];
  recentSignups: RecentSignup[];
  pastDueUsers: PastDueUser[];
  connectIssues: ConnectIssue[];
  dormantUsers: DormantUser[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isPayingActive(u: AdminUser): boolean {
  return (
    u.subscription_status === "active" &&
    !u.is_comped &&
    !u.is_beta_user &&
    !!u.stripe_subscription_id &&
    !!u.subscription_plan
  );
}

function computeMrr(users: AdminUser[]): MrrBreakdown {
  let pro = 0;
  let max = 0;
  let proCount = 0;
  let maxCount = 0;
  for (const u of users) {
    if (!isPayingActive(u)) continue;
    if (u.subscription_plan === "pro") {
      pro += PLAN_PRICE.pro!;
      proCount++;
    } else if (u.subscription_plan === "max") {
      max += PLAN_PRICE.max!;
      maxCount++;
    }
  }
  return { total: pro + max, pro, max, proCount, maxCount };
}

function computeSubscriberCounts(users: AdminUser[], now: number): SubscriberCounts {
  let paying = 0;
  let comped = 0;
  let pastDue = 0;
  let cancelled = 0;
  let freeStarter = 0;
  for (const u of users) {
    if (u.is_comped) {
      comped++;
      continue;
    }
    if (u.subscription_status === "past_due") {
      pastDue++;
      continue;
    }
    if (isPayingActive(u)) {
      paying++;
      continue;
    }
    if (u.subscription_status === "cancelled" || u.subscription_status === "expired") {
      const endMs = u.subscription_end ? new Date(u.subscription_end).getTime() : 0;
      if (endMs < now) {
        cancelled++;
        continue;
      }
    }
    // Anything else: signed up, on the free Starter tier (5-couple
    // cap), no Stripe subscription.
    freeStarter++;
  }
  return { total: users.length, paying, comped, pastDue, cancelled, freeStarter };
}

function computeChurn(users: AdminUser[], now: number): ChurnSummary {
  const windowStart = now - 30 * MS_PER_DAY;
  let cancelledLast30d = 0;
  let activeNow = 0;
  let pendingCancellations = 0;
  for (const u of users) {
    if (isPayingActive(u)) {
      activeNow++;
      if (u.cancel_at_period_end) pendingCancellations++;
    }
    if (u.subscription_status === "cancelled" && u.subscription_end) {
      const endMs = new Date(u.subscription_end).getTime();
      if (endMs >= windowStart && endMs <= now) cancelledLast30d++;
    }
  }
  const denom = activeNow + cancelledLast30d;
  const monthlyRate = denom > 0 ? cancelledLast30d / denom : 0;
  return { cancelledLast30d, activeNow, monthlyRate, pendingCancellations };
}

function computeRenewals(users: AdminUser[], now: number): UpcomingRenewals {
  const cap30 = now + 30 * MS_PER_DAY;
  const cap7 = now + 7 * MS_PER_DAY;
  const next30d: UpcomingRenewal[] = [];
  for (const u of users) {
    if (!isPayingActive(u)) continue;
    if (!u.subscription_end) continue;
    const endMs = new Date(u.subscription_end).getTime();
    if (endMs < now || endMs > cap30) continue;
    const amount =
      (u.subscription_plan && PLAN_PRICE[u.subscription_plan]) ?? 0;
    next30d.push({
      userId: u.id,
      email: u.email,
      business_name: u.business_name,
      plan: u.subscription_plan,
      amount,
      subscription_end: u.subscription_end,
      daysUntil: Math.ceil((endMs - now) / MS_PER_DAY),
      cancel_at_period_end: u.cancel_at_period_end,
    });
  }
  next30d.sort((a, b) => a.daysUntil - b.daysUntil);
  const next7d = next30d.filter((r) => r.daysUntil <= 7);
  const next30dValue = next30d
    .filter((r) => !r.cancel_at_period_end)
    .reduce((sum, r) => sum + r.amount, 0);
  return { next7d, next30d, next30dValue };
}

interface EngagementCounts {
  active30dUserIds: Set<string>;
  everEngagedUserIds: Set<string>;
}

async function loadEngagementSets(): Promise<EngagementCounts> {
  const admin = adminClient();
  const cutoff = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();

  // Active-in-last-30d set. A "use" event is any new row in any of
  // these tables. We deliberately keep this list small (couples /
  // events / invoices / contracts / proposals) — these are the surfaces
  // that signal real product use.
  const [active30dResults, everEngagedResults] = await Promise.all([
    Promise.all([
      admin.from("couples").select("user_id").gte("created_at", cutoff),
      admin.from("events").select("user_id").gte("created_at", cutoff),
      admin.from("invoices").select("user_id").gte("created_at", cutoff),
      admin.from("contracts").select("user_id").gte("created_at", cutoff),
      admin.from("proposals").select("user_id").gte("created_at", cutoff),
    ]),
    // Ever-engaged set: any couple ever created. If a user has
    // ZERO couples in their history they've never used the core
    // funnel.
    admin.from("couples").select("user_id"),
  ]);

  const active = new Set<string>();
  for (const r of active30dResults) {
    for (const row of (r.data ?? []) as Array<{ user_id: string }>) {
      active.add(row.user_id);
    }
  }
  const ever = new Set<string>();
  for (const row of (everEngagedResults.data ?? []) as Array<{ user_id: string }>) {
    ever.add(row.user_id);
  }
  return { active30dUserIds: active, everEngagedUserIds: ever };
}

function computeEngagement(
  users: AdminUser[],
  counts: EngagementCounts,
  now: number,
): EngagementSummary {
  const dormantCutoff = now - 30 * MS_PER_DAY;
  const weekCutoff = now - 7 * MS_PER_DAY;
  let dormant = 0;
  let newThisWeek = 0;
  for (const u of users) {
    const createdMs = new Date(u.created_at).getTime();
    if (createdMs < dormantCutoff && !counts.everEngagedUserIds.has(u.id)) {
      dormant++;
    }
    if (createdMs >= weekCutoff) newThisWeek++;
  }
  // The Set is the source of truth for who's been active —
  // user_ids in the activity tables may include deleted users
  // (rare), but that's a benign overcount.
  return {
    activeLast30d: counts.active30dUserIds.size,
    dormantAccounts: dormant,
    newThisWeek,
  };
}

function startOfWeek(d: Date): Date {
  // Monday = day 1 (en-AU local). Sunday becomes the END of the
  // previous week — see the dashboard period helpers for the same
  // convention (lib/dashboard/periods.ts).
  const day = d.getDay(); // 0 (Sun) ... 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function computeSignupsChart(users: AdminUser[], now: Date): SignupsChartPoint[] {
  const weeks = 12;
  const buckets: SignupsChartPoint[] = [];
  const currentWeekStart = startOfWeek(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({
      weekStart: start.toISOString(),
      label: start.toLocaleDateString("en-AU", {
        month: "short",
        day: "numeric",
      }),
      count: 0,
    });
  }
  // Bucket lower bound — earliest week-start we care about.
  const earliestMs = new Date(buckets[0]!.weekStart).getTime();
  for (const u of users) {
    const createdMs = new Date(u.created_at).getTime();
    if (createdMs < earliestMs) continue;
    // Find the right bucket: count of full weeks since the earliest
    // bucket. Clamp to the last bucket if the user was created in
    // the current week.
    const weeksSinceEarliest = Math.floor((createdMs - earliestMs) / (7 * MS_PER_DAY));
    const idx = Math.min(weeksSinceEarliest, weeks - 1);
    buckets[idx]!.count++;
  }
  return buckets;
}

function computePastDue(users: AdminUser[]): PastDueUser[] {
  return users
    .filter((u) => u.subscription_status === "past_due")
    .map((u) => ({
      id: u.id,
      email: u.email,
      business_name: u.business_name,
      subscription_plan: u.subscription_plan,
      stripe_customer_id: u.stripe_customer_id,
    }));
}

async function loadConnectIssues(): Promise<ConnectIssue[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("connect_accounts")
    .select(
      "user_id, account_id, disabled_reason, requirements_past_due, charges_enabled, payouts_enabled",
    );
  if (error) throw error;
  return (data ?? [])
    .filter((row) => {
      if (row.disabled_reason) return true;
      const pastDue = row.requirements_past_due;
      return Array.isArray(pastDue) && (pastDue as unknown[]).length > 0;
    })
    .map((row) => ({
      user_id: row.user_id,
      account_id: row.account_id,
      disabled_reason: row.disabled_reason,
      requirements_past_due: Array.isArray(row.requirements_past_due)
        ? (row.requirements_past_due as string[])
        : [],
      charges_enabled: row.charges_enabled,
      payouts_enabled: row.payouts_enabled,
    }));
}

function computeDormantUsers(
  users: AdminUser[],
  counts: EngagementCounts,
  now: number,
  limit = 6,
): DormantUser[] {
  const dormantCutoffMs = now - 30 * MS_PER_DAY;
  return users
    .filter((u) => {
      const createdMs = new Date(u.created_at).getTime();
      return createdMs < dormantCutoffMs && !counts.everEngagedUserIds.has(u.id);
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, limit)
    .map((u) => ({
      id: u.id,
      email: u.email,
      business_name: u.business_name,
      created_at: u.created_at,
      daysSinceSignup: Math.floor(
        (now - new Date(u.created_at).getTime()) / MS_PER_DAY,
      ),
    }));
}

// ── Time-series helpers ──────────────────────────────────────────
//
// The dashboard's 4 hero metrics (MRR / active subs / churn / new
// signups) each render as a 12-week area chart. We don't keep a
// historical state log (e.g. nightly snapshots of `subscription_status`),
// so the series below are **approximations** reconstructed from the
// current state of every user:
//
//   - signups[i] = users created during week i (exact).
//   - active[i] = users who looked active at week-end i:
//       paying-now AND created ≤ week-end
//       OR cancelled AND sub_end ≥ week-end AND created ≤ week-end.
//   - mrr[i] = sum of plan price across active[i], using the user's
//             current plan price (drift = some users may have changed
//             plans; for a 12-week window this is acceptable).
//   - churn[i] = cancellations whose sub_end falls in week i.
//
// If the founder ever needs forensic accuracy we'd back this with a
// nightly snapshot table; for the "at-a-glance trend" view it's
// good enough.

function isCurrentlyPayingActive(u: AdminUser): boolean {
  return isPayingActive(u);
}

function isCountedActiveAt(u: AdminUser, weekEndMs: number): boolean {
  const createdMs = new Date(u.created_at).getTime();
  if (createdMs > weekEndMs) return false; // not signed up yet
  if (isCurrentlyPayingActive(u)) return true;
  if (
    (u.subscription_status === 'cancelled' || u.subscription_status === 'expired') &&
    u.subscription_end
  ) {
    const endMs = new Date(u.subscription_end).getTime();
    return endMs >= weekEndMs;
  }
  return false;
}

/** Build the 12 weekly bucket boundaries (oldest-first), each ending at week-end. */
function weeklyBuckets(now: Date, weeks = 12): { start: Date; end: Date; label: string }[] {
  const currentWeekStart = startOfWeek(now);
  const buckets: { start: Date; end: Date; label: string }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({
      start,
      end,
      label: start.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
    });
  }
  return buckets;
}

function buildSeries(
  buckets: ReturnType<typeof weeklyBuckets>,
  valueAt: (bucketEndMs: number) => number,
): MetricSeries {
  const points: MetricSeriesPoint[] = buckets.map((b) => ({
    weekStart: b.start.toISOString(),
    label: b.label,
    value: valueAt(b.end.getTime()),
  }));
  const current = points[points.length - 1]?.value ?? 0;
  const previous = points[points.length - 2]?.value ?? 0;
  const percentChange =
    previous === 0
      ? current === 0
        ? 0
        : 100
      : Math.round(((current - previous) / previous) * 100);
  return { current, previous, percentChange, points };
}

function computeMrrSeries(
  users: AdminUser[],
  buckets: ReturnType<typeof weeklyBuckets>,
): MetricSeries {
  return buildSeries(buckets, (weekEndMs) => {
    let mrr = 0;
    for (const u of users) {
      if (!isCountedActiveAt(u, weekEndMs)) continue;
      if (u.subscription_plan && PLAN_PRICE[u.subscription_plan]) {
        // Approximation: use the user's CURRENT plan price for every
        // bucket. A user who upgraded mid-window will show their new
        // price all the way back — acceptable noise for a 12-week
        // trend.
        if (isCurrentlyPayingActive(u)) mrr += PLAN_PRICE[u.subscription_plan]!;
      }
    }
    return mrr;
  });
}

function computeActiveSubsSeries(
  users: AdminUser[],
  buckets: ReturnType<typeof weeklyBuckets>,
): MetricSeries {
  return buildSeries(buckets, (weekEndMs) => {
    let n = 0;
    for (const u of users) {
      if (isCountedActiveAt(u, weekEndMs)) n++;
    }
    return n;
  });
}

function computeChurnSeries(
  users: AdminUser[],
  buckets: ReturnType<typeof weeklyBuckets>,
): MetricSeries {
  return buildSeries(buckets, (weekEndMs) => {
    let n = 0;
    const weekStartMs = weekEndMs - 7 * MS_PER_DAY;
    for (const u of users) {
      if (u.subscription_status !== 'cancelled') continue;
      if (!u.subscription_end) continue;
      const endMs = new Date(u.subscription_end).getTime();
      if (endMs >= weekStartMs && endMs < weekEndMs) n++;
    }
    return n;
  });
}

function computeSignupsSeries(
  users: AdminUser[],
  buckets: ReturnType<typeof weeklyBuckets>,
): MetricSeries {
  return buildSeries(buckets, (weekEndMs) => {
    let n = 0;
    const weekStartMs = weekEndMs - 7 * MS_PER_DAY;
    for (const u of users) {
      const createdMs = new Date(u.created_at).getTime();
      if (createdMs >= weekStartMs && createdMs < weekEndMs) n++;
    }
    return n;
  });
}

function computeRecentSignups(users: AdminUser[], limit = 6): RecentSignup[] {
  return [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      business_name: u.business_name,
      created_at: u.created_at,
    }));
}

/**
 * One-pass aggregator for the new single-pane admin dashboard.
 * Runs `listUsersWithSubscription` + a small set of engagement
 * queries, then derives every card / chart the dashboard renders.
 */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const now = Date.now();
  const [users, engagementCounts, connectIssues] = await Promise.all([
    listUsersWithSubscription(),
    loadEngagementSets(),
    loadConnectIssues(),
  ]);
  const buckets = weeklyBuckets(new Date(now));
  const signupsSeries = computeSignupsSeries(users, buckets);
  return {
    mrr: computeMrr(users),
    subscribers: computeSubscriberCounts(users, now),
    churn: computeChurn(users, now),
    renewals: computeRenewals(users, now),
    engagement: computeEngagement(users, engagementCounts, now),
    series: {
      mrr: computeMrrSeries(users, buckets),
      activeSubs: computeActiveSubsSeries(users, buckets),
      churnRate: computeChurnSeries(users, buckets),
      signups: signupsSeries,
    },
    // Backwards compatible single-series shape — same data the
    // existing SignupsChart component already consumes.
    signupsChart: signupsSeries.points.map((p) => ({
      weekStart: p.weekStart,
      label: p.label,
      count: p.value,
    })),
    recentSignups: computeRecentSignups(users),
    pastDueUsers: computePastDue(users),
    connectIssues,
    dormantUsers: computeDormantUsers(users, engagementCounts, now),
  };
}
