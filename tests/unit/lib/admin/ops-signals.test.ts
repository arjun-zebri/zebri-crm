/**
 * Unit tests for the pure helpers in `lib/admin/ops-signals.ts`.
 * The Supabase-talking `findConnectIssues` / `getOpsSnapshot` are
 * exercised manually + by `audit-log-flow` indirectly; these tests
 * pin the date-math + filter logic the Ops tab depends on.
 */
import { describe, expect, it } from 'vitest';

import type { AdminUser } from '@/lib/admin/admin-analytics';
import {
  findPastDueUsers,
  findTrialsEndingSoon,
} from '@/lib/admin/ops-signals';

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-' + Math.random().toString(36).slice(2, 8),
    email: 'x@example.test',
    display_name: '',
    business_name: '',
    account_type: 'vendor',
    subscription_status: null,
    subscription_plan: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_end: null,
    subscription_end: null,
    cancel_at_period_end: false,
    is_subscribed: false,
    is_beta_user: false,
    is_comped: false,
    created_at: '2026-01-01T00:00:00Z',
    last_sign_in_at: null,
    ...overrides,
  };
}

describe('findTrialsEndingSoon', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const inDays = (n: number) =>
    new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

  it('includes trialing users whose trial_end falls in the next 7 days', () => {
    const users = [
      user({ trial_end: inDays(3), subscription_status: 'trialing' }),
      user({ trial_end: inDays(6.9), subscription_status: 'trialing' }),
    ];
    const out = findTrialsEndingSoon(users, 7, now);
    expect(out).toHaveLength(2);
    expect(out[0]!.daysRemaining).toBe(3);
  });

  it('sorts soonest-first', () => {
    const users = [
      user({ id: 'a', trial_end: inDays(6), subscription_status: 'trialing' }),
      user({ id: 'b', trial_end: inDays(1), subscription_status: 'trialing' }),
      user({ id: 'c', trial_end: inDays(3), subscription_status: 'trialing' }),
    ];
    const ids = findTrialsEndingSoon(users, 7, now).map((u) => u.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('excludes users with status != trialing', () => {
    const users = [
      user({ trial_end: inDays(2), subscription_status: 'active' }),
      user({ trial_end: inDays(2), subscription_status: 'past_due' }),
      user({ trial_end: inDays(2), subscription_status: null }),
    ];
    expect(findTrialsEndingSoon(users, 7, now)).toEqual([]);
  });

  it('excludes already-comped users', () => {
    const users = [
      user({
        trial_end: inDays(2),
        subscription_status: 'trialing',
        is_comped: true,
      }),
    ];
    expect(findTrialsEndingSoon(users, 7, now)).toEqual([]);
  });

  it('excludes users with a live Stripe subscription', () => {
    const users = [
      user({
        trial_end: inDays(2),
        subscription_status: 'trialing',
        stripe_subscription_id: 'sub_123',
      }),
    ];
    expect(findTrialsEndingSoon(users, 7, now)).toEqual([]);
  });

  it('excludes trials that have already lapsed', () => {
    const users = [
      user({ trial_end: inDays(-1), subscription_status: 'trialing' }),
    ];
    expect(findTrialsEndingSoon(users, 7, now)).toEqual([]);
  });

  it('excludes trials beyond the window', () => {
    const users = [
      user({ trial_end: inDays(8), subscription_status: 'trialing' }),
    ];
    expect(findTrialsEndingSoon(users, 7, now)).toEqual([]);
  });
});

describe('findPastDueUsers', () => {
  it('returns only past_due users', () => {
    const users = [
      user({ id: 'a', subscription_status: 'past_due' }),
      user({ id: 'b', subscription_status: 'active' }),
      user({ id: 'c', subscription_status: 'past_due' }),
      user({ id: 'd', subscription_status: null }),
    ];
    const ids = findPastDueUsers(users).map((u) => u.id);
    expect(ids).toEqual(['a', 'c']);
  });
});
