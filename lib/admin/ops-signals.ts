/**
 * Ops signals for the Phase 13 admin Ops tab.
 *
 * Pulls together cross-table queries that surface "users who need
 * human attention right now" — trials ending in the next 7 days,
 * subscriptions stuck in `past_due`, and Connect accounts whose
 * payouts/charges are blocked.
 *
 * All queries run with the service-role client; the page is gated
 * by `isAdmin()` at the route + server-action layer.
 *
 * @module lib/admin/ops-signals
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';

import { listUsersWithSubscription, type AdminUser } from './admin-analytics';

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface TrialEndingUser {
  id: string;
  email: string;
  business_name: string;
  trial_end: string;
  daysRemaining: number;
}

/**
 * Users whose `app_metadata.trial_end` falls in the next `daysAhead`
 * days. Sorted soonest-first. Excludes users who are already
 * comped, already paying via Stripe, or whose subscription is past
 * the trial window — the goal is "trials that will lapse soon
 * without intervention".
 */
export function findTrialsEndingSoon(
  users: AdminUser[],
  daysAhead = 7,
  now: Date = new Date(),
): TrialEndingUser[] {
  const horizonMs = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const out: TrialEndingUser[] = [];
  for (const u of users) {
    if (!u.trial_end) continue;
    if (u.is_comped) continue;
    if (u.stripe_subscription_id) continue;
    if (u.subscription_status !== 'trialing') continue;
    const endMs = new Date(u.trial_end).getTime();
    if (endMs <= nowMs) continue;
    if (endMs > horizonMs) continue;
    out.push({
      id: u.id,
      email: u.email,
      business_name: u.business_name,
      trial_end: u.trial_end,
      daysRemaining: Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000)),
    });
  }
  out.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return out;
}

export interface PastDueUser {
  id: string;
  email: string;
  business_name: string;
  subscription_plan: string | null;
  stripe_customer_id: string | null;
}

/**
 * Users whose subscription is stuck in `past_due` — Stripe's
 * automatic retry is failing or the card is declined. Needs
 * human outreach.
 */
export function findPastDueUsers(users: AdminUser[]): PastDueUser[] {
  return users
    .filter((u) => u.subscription_status === 'past_due')
    .map((u) => ({
      id: u.id,
      email: u.email,
      business_name: u.business_name,
      subscription_plan: u.subscription_plan,
      stripe_customer_id: u.stripe_customer_id,
    }));
}

export interface ConnectIssue {
  user_id: string;
  account_id: string | null;
  disabled_reason: string | null;
  requirements_past_due: string[];
  requirements_currently_due: string[];
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

/**
 * Connect accounts whose ability to take couple payments is broken —
 * either Stripe set a `disabled_reason`, or has flagged some
 * requirement as past-due. These users can't get paid through the
 * public invoice surface today.
 */
export async function findConnectIssues(): Promise<ConnectIssue[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('connect_accounts')
    .select(
      'user_id, account_id, disabled_reason, requirements_past_due, requirements_currently_due, charges_enabled, payouts_enabled',
    );
  if (error) throw error;
  return (data ?? [])
    .filter(
      (row) =>
        row.disabled_reason !== null ||
        (Array.isArray(row.requirements_past_due) &&
          (row.requirements_past_due as unknown[]).length > 0),
    )
    .map((row) => ({
      user_id: row.user_id,
      account_id: row.account_id,
      disabled_reason: row.disabled_reason,
      requirements_past_due: Array.isArray(row.requirements_past_due)
        ? (row.requirements_past_due as string[])
        : [],
      requirements_currently_due: Array.isArray(row.requirements_currently_due)
        ? (row.requirements_currently_due as string[])
        : [],
      charges_enabled: row.charges_enabled,
      payouts_enabled: row.payouts_enabled,
    }));
}

export interface OpsSnapshot {
  trialsEnding: TrialEndingUser[];
  pastDue: PastDueUser[];
  connectIssues: ConnectIssue[];
}

/** Resolve every Ops-tab card in one pass. */
export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const [users, connectIssues] = await Promise.all([
    listUsersWithSubscription(),
    findConnectIssues(),
  ]);
  return {
    trialsEnding: findTrialsEndingSoon(users),
    pastDue: findPastDueUsers(users),
    connectIssues,
  };
}
