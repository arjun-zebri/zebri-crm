/**
 * Phase 1 — full billing-state matrix.
 *
 * Per the explicit "test every possible billing scenario" ask, this
 * suite walks every canonical state through the entitlements helper
 * and asserts the right answers come out. Stripe lifecycle event →
 * state-change tests stay Phase 2 (alongside the webhook hardening).
 *
 * Each test creates a real auth user via the admin API with the
 * matching `app_metadata`, fetches the user back, and runs the
 * helper against the live row — so we exercise the actual data
 * shape Supabase returns, not a hand-built mock.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  accountType,
  contractCoupleLimit,
  currentPlan,
  isActive,
  isAdmin,
  isSubscribed,
  STARTER_CONTRACT_COUPLE_LIMIT,
  stripeConnectEnabled,
  stripeCustomerId,
  subscriptionPlan,
  subscriptionStatus,
} from '@/lib/auth/entitlements';

import {
  userInState,
  type BillingState,
} from '../helpers/billing-states';
import {
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

async function getServerUser(user: TestUser) {
  const admin = serviceClient();
  const { data } = await admin.auth.admin.getUserById(user.id);
  if (!data.user) throw new Error('user not found');
  return data.user;
}

describe('billing scenarios — 8-state matrix', () => {
  let user: TestUser;
  afterEach(async () => {
    await user?.cleanup();
  });

  describe('1. never trialled (no subscription)', () => {
    beforeEach(async () => {
      user = await userInState('never_trialled');
    });
    it('reads as Starter, no active access, contracts capped at 5 couples', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBeUndefined();
      expect(isActive(u)).toBe(false);
      expect(currentPlan(u)).toBe('starter');
      expect(contractCoupleLimit(u)).toBe(STARTER_CONTRACT_COUPLE_LIMIT);
      expect(isSubscribed(u)).toBe(false);
    });
  });

  describe('2. trialing (within trial)', () => {
    beforeEach(async () => {
      user = await userInState('trialing', { plan: 'pro' });
    });
    it('reads as Pro, active, contracts uncapped', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBe('trialing');
      expect(isActive(u)).toBe(true);
      expect(currentPlan(u)).toBe('pro');
      expect(contractCoupleLimit(u)).toBeNull();
      expect(isSubscribed(u)).toBe(true);
    });
  });

  describe('3. trial expired (trial_end past, status still trialing)', () => {
    beforeEach(async () => {
      user = await userInState('trial_expired');
    });
    it('helper still says trialing — date-based downgrade is the UI/middleware concern', async () => {
      const u = await getServerUser(user);
      // The helper reports raw subscription_status. UI / middleware
      // interpret trial_end < now as "trial expired" and show the
      // appropriate copy / paywall. This separation is intentional.
      expect(subscriptionStatus(u)).toBe('trialing');
      expect(isActive(u)).toBe(true);
    });
  });

  describe('4. active subscription', () => {
    beforeEach(async () => {
      user = await userInState('active', { plan: 'pro' });
    });
    it('reads as Pro, active, has Stripe customer', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBe('active');
      expect(isActive(u)).toBe(true);
      expect(currentPlan(u)).toBe('pro');
      expect(stripeCustomerId(u)).toBe('cus_test_active');
    });
  });

  describe('5. cancelling in grace (active + cancel_at_period_end)', () => {
    beforeEach(async () => {
      user = await userInState('cancelling_in_grace', { plan: 'pro' });
    });
    it('reads as active (grace not yet ended), Pro features still on', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBe('active');
      expect(isActive(u)).toBe(true);
      expect(currentPlan(u)).toBe('pro');
      // cancel_at_period_end is a UI flag — the helper reports it raw via the app_metadata read.
      expect(u.app_metadata?.cancel_at_period_end).toBe(true);
    });
  });

  describe('6. past_due (charge failed)', () => {
    beforeEach(async () => {
      user = await userInState('past_due', { plan: 'pro' });
    });
    it('reads as past_due, not active, downgrades plan and recaps contracts', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBe('past_due');
      expect(isActive(u)).toBe(false);
      expect(currentPlan(u)).toBe('starter');
      expect(contractCoupleLimit(u)).toBe(STARTER_CONTRACT_COUPLE_LIMIT);
    });
  });

  describe('7. expired (post-grace)', () => {
    beforeEach(async () => {
      user = await userInState('expired');
    });
    it('reads as expired, downgrades to Starter', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBe('expired');
      expect(isActive(u)).toBe(false);
      expect(currentPlan(u)).toBe('starter');
    });
  });

  describe('8. comped (admin-set active, no Stripe customer)', () => {
    beforeEach(async () => {
      user = await userInState('comped', { plan: 'max' });
    });
    it('reads as active, Max plan, no Stripe customer', async () => {
      const u = await getServerUser(user);
      expect(subscriptionStatus(u)).toBe('active');
      expect(isActive(u)).toBe(true);
      expect(currentPlan(u)).toBe('max');
      expect(stripeCustomerId(u)).toBeUndefined();
      expect(u.app_metadata?.is_comped).toBe(true);
    });
  });
});

describe('billing scenarios — plan-tier gating', () => {
  let user: TestUser;
  afterEach(async () => {
    await user?.cleanup();
  });

  it.each<[plan: 'starter' | 'pro' | 'max', limit: number | null]>([
    ['starter', STARTER_CONTRACT_COUPLE_LIMIT],
    ['pro', null],
    ['max', null],
  ])('plan=%s → contractCoupleLimit=%s', async (plan, expected) => {
    user = await userInState('active', { plan });
    const u = await getServerUser(user);
    expect(currentPlan(u)).toBe(plan);
    expect(contractCoupleLimit(u)).toBe(expected);
  });

  it('admin role from app_metadata is independent of subscription state', async () => {
    user = await userInState('expired');
    // Override account_type to admin (admin override is independent of
    // subscription state — admins always get in).
    const admin = serviceClient();
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(await admin.auth.admin.getUserById(user.id)).data.user!.app_metadata,
        account_type: 'admin',
      },
    });
    const u = await getServerUser(user);
    expect(isAdmin(u)).toBe(true);
    expect(accountType(u)).toBe('admin');
    // Subscription stays expired.
    expect(subscriptionStatus(u)).toBe('expired');
  });
});

describe('billing scenarios — Stripe Connect identity (UX flag, separate from billing)', () => {
  let user: TestUser;
  afterEach(async () => {
    await user?.cleanup();
  });

  it('stripeConnectEnabled defaults to false', async () => {
    user = await userInState('active');
    const u = await getServerUser(user);
    expect(stripeConnectEnabled(u)).toBe(false);
  });

  it('stripeConnectEnabled=true after server-side onboarding completes', async () => {
    user = await userInState('active');
    const admin = serviceClient();
    const existing = (await admin.auth.admin.getUserById(user.id)).data.user!.app_metadata;
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...existing,
        stripe_connect_account_id: 'acct_test',
        stripe_connect_enabled: true,
      },
    });
    const u = await getServerUser(user);
    expect(stripeConnectEnabled(u)).toBe(true);
  });
});

describe('billing scenarios — subscriptionPlan reflects raw value (helper is pure)', () => {
  let user: TestUser;
  afterEach(async () => {
    await user?.cleanup();
  });
  it('returns the raw plan slug from app_metadata', async () => {
    user = await userInState('active', { plan: 'max' });
    const u = await getServerUser(user);
    expect(subscriptionPlan(u)).toBe('max');
  });
});
