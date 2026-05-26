import { describe, expect, it, vi } from 'vitest';

import {
  accountType,
  type AuthAdmin,
  currentPlan,
  hasContractsAccess,
  isActive,
  isAdmin,
  isBetaUser,
  isSubscribed,
  stripeConnectAccountId,
  stripeConnectEnabled,
  stripeCustomerId,
  subscriptionPlan,
  subscriptionStatus,
  updateEntitlements,
} from '@/lib/auth/entitlements';

/**
 * Canonical tests pinning the §7.4 privilege-escalation blocks.
 *
 * Every "user_metadata says X but app_metadata says Y" case must
 * return the app_metadata value — that's the whole point of 0.8b.
 * If any of these tests start failing, a regression has un-fixed
 * the escalation hole.
 */
describe('entitlements — privilege-escalation blocks', () => {
  it('a user-metadata `account_type: admin` claim is IGNORED when app_metadata says otherwise', () => {
    const attacker = {
      app_metadata: { account_type: 'vendor' },
      user_metadata: { account_type: 'admin' }, // self-set via auth.updateUser
    };
    expect(isAdmin(attacker)).toBe(false);
    expect(accountType(attacker)).toBe('vendor');
  });

  it('a user-metadata `subscription_status: active` claim does NOT unlock paid features', () => {
    const attacker = {
      // account_type set by the backfill — marks this user as migrated,
      // so user_metadata is ignored entirely for entitlement reads.
      app_metadata: { account_type: 'vendor', subscription_status: 'expired', subscription_plan: 'pro' },
      user_metadata: { subscription_status: 'active', subscription_plan: 'max', is_subscribed: true },
    };
    expect(subscriptionStatus(attacker)).toBe('expired');
    expect(isActive(attacker)).toBe(false);
    expect(currentPlan(attacker)).toBe('starter');
    expect(hasContractsAccess(attacker)).toBe(false);
    expect(isSubscribed(attacker)).toBe(false);
  });

  it('a user-metadata `stripe_connect_enabled: true` claim does NOT change payout routing', () => {
    const attacker = {
      app_metadata: { account_type: 'vendor', stripe_connect_enabled: false },
      user_metadata: { stripe_connect_enabled: true, stripe_connect_account_id: 'acct_other' },
    };
    expect(stripeConnectEnabled(attacker)).toBe(false);
    // Field absent from app_metadata + user is migrated → ignored entirely.
    expect(stripeConnectAccountId(attacker)).toBeUndefined();
  });

  it('a user-metadata `is_beta_user: true` claim does NOT grant beta pricing', () => {
    const attacker = {
      app_metadata: { account_type: 'vendor', is_beta_user: false },
      user_metadata: { is_beta_user: true },
    };
    expect(isBetaUser(attacker)).toBe(false);
  });

  it("a migrated user's empty app_metadata field is NOT filled in from user_metadata (no escalation via gaps)", () => {
    // The backfill set account_type but didn't yet backfill stripe_customer_id.
    // The attacker self-set stripe_customer_id in user_metadata. The helper
    // must NOT pick that up — migrated state means app_metadata is
    // authoritative even for keys it doesn't have.
    const attacker = {
      app_metadata: { account_type: 'vendor' },
      user_metadata: { stripe_customer_id: 'cus_attacker' },
    };
    expect(stripeCustomerId(attacker)).toBeUndefined();
  });
});

describe('entitlements — server-managed reads (app_metadata wins)', () => {
  it('returns admin when app_metadata.account_type === admin', () => {
    expect(isAdmin({ app_metadata: { account_type: 'admin' } })).toBe(true);
  });

  it('returns vendor when app_metadata.account_type is missing', () => {
    expect(accountType({ app_metadata: {} })).toBe('vendor');
  });

  it('currentPlan honours app_metadata trialing+pro', () => {
    expect(currentPlan({ app_metadata: { subscription_status: 'trialing', subscription_plan: 'pro' } })).toBe('pro');
  });

  it('returns the configured stripe_customer_id from app_metadata', () => {
    expect(stripeCustomerId({ app_metadata: { stripe_customer_id: 'cus_123' } })).toBe('cus_123');
  });

  it('subscriptionPlan/subscriptionStatus reflect app_metadata', () => {
    const u = { app_metadata: { subscription_status: 'active', subscription_plan: 'max' } };
    expect(subscriptionStatus(u)).toBe('active');
    expect(subscriptionPlan(u)).toBe('max');
  });
});

describe('entitlements — user_metadata is never consulted (Phase 1)', () => {
  /**
   * Phase 1 removed the transitional fallback. `app_metadata` is the
   * SOLE source of truth — even if a field is missing from
   * `app_metadata`, `user_metadata` is never consulted. Tightens the
   * §7.4 fix by removing the transitional escape hatch.
   */
  it('an admin claim in user_metadata is IGNORED even when app_metadata is empty', () => {
    expect(isAdmin({ user_metadata: { account_type: 'admin' } })).toBe(false);
    expect(accountType({ user_metadata: { account_type: 'admin' } })).toBe('vendor');
  });

  it('a paid-status claim in user_metadata does NOT grant access', () => {
    expect(
      currentPlan({ user_metadata: { subscription_status: 'active', subscription_plan: 'pro' } }),
    ).toBe('starter');
    expect(
      isActive({ user_metadata: { subscription_status: 'active' } }),
    ).toBe(false);
  });

  it('null app_metadata + admin in user_metadata is still NOT admin', () => {
    expect(isAdmin({ app_metadata: null, user_metadata: { account_type: 'admin' } })).toBe(false);
  });

  it('handles null/undefined source', () => {
    expect(isAdmin(null)).toBe(false);
    expect(accountType(undefined)).toBe('vendor');
    expect(currentPlan(null)).toBe('starter');
  });
});

describe('entitlements — paywall edge cases', () => {
  it('expired subscription falls back to starter regardless of plan', () => {
    expect(currentPlan({ app_metadata: { subscription_status: 'expired', subscription_plan: 'pro' } })).toBe('starter');
  });

  it('unknown plan with active status falls back to starter', () => {
    expect(currentPlan({ app_metadata: { subscription_status: 'active', subscription_plan: 'enterprise' } })).toBe('starter');
  });
});

/**
 * `updateEntitlements` clear semantics — the load-bearing fix from
 * Phase 2D.1. Supabase's `auth.admin.updateUserById` MERGES
 * `app_metadata`, so to actually clear a key we must send an
 * explicit `null` value (sending `undefined` makes JSON.stringify
 * drop the key entirely, leaving the existing value untouched).
 * These tests pin the invariant that:
 *
 * 1. `undefined` and `null` patch values both reach the admin API
 *    as literal `null` (which Supabase will then merge in,
 *    overwriting the existing value).
 * 2. Non-null primitives — including `false` and `0` — pass through
 *    unmodified.
 *
 * Without these, the silent-no-op clear regression that bit Phase
 * 2D.1 disconnect could re-land and we wouldn't catch it until a
 * customer reported a stuck Stripe binding.
 */
describe('updateEntitlements — clear semantics', () => {
  function makeFakeAdmin(): AuthAdmin & { calls: { id: string; attrs: { app_metadata?: Record<string, unknown> } }[] } {
    const calls: { id: string; attrs: { app_metadata?: Record<string, unknown> } }[] = [];
    return {
      calls,
      getUserById: vi.fn(async () => ({
        data: { user: { app_metadata: { existing: 'stays' }, user_metadata: null } },
        error: null,
      })),
      updateUserById: vi.fn(async (id, attrs) => {
        calls.push({ id, attrs });
        return { data: null, error: null };
      }),
    };
  }

  it('undefined patch value sends null to admin.updateUserById', async () => {
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      stripe_connect_account_id: undefined,
    });
    expect(admin.calls).toHaveLength(1);
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      stripe_connect_account_id: null,
    });
  });

  it('null patch value sends null to admin.updateUserById', async () => {
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      stripe_connect_account_id: null,
    });
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      stripe_connect_account_id: null,
    });
  });

  it('boolean `false` passes through (not coerced to null — the regression that bit 2D.1)', async () => {
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      stripe_connect_enabled: false,
    });
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      stripe_connect_enabled: false,
    });
  });

  it('numeric `0` passes through', async () => {
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      trial_credits: 0,
    });
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      trial_credits: 0,
    });
  });

  it('empty string passes through', async () => {
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      display_name: '',
    });
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      display_name: '',
    });
  });

  it('mixed patch — sets one, clears another — produces the right merged payload', async () => {
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      stripe_connect_account_id: undefined,
      stripe_connect_enabled: false,
      subscription_plan: 'pro',
    });
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      stripe_connect_account_id: null,
      stripe_connect_enabled: false,
      subscription_plan: 'pro',
    });
  });

  it('only writes the keys in the patch — does NOT re-send existing app_metadata fields', async () => {
    // Regression guard: the original implementation read existing
    // app_metadata, merged the patch on top, and wrote the whole
    // merged object back. That gave the appearance of "REPLACE"
    // semantics but actually let Supabase silently no-op clears.
    // The new implementation relies on Supabase's documented MERGE
    // behaviour: we send only the keys we want to mutate, and any
    // other existing keys stay untouched on the server.
    const admin = makeFakeAdmin();
    await updateEntitlements(admin, 'user-1', {
      subscription_plan: 'max',
    });
    expect(admin.calls[0]?.attrs.app_metadata).toEqual({
      subscription_plan: 'max',
    });
    // The fake `existing.app_metadata.existing = 'stays'` must NOT
    // appear in the write payload.
    expect(admin.calls[0]?.attrs.app_metadata).not.toHaveProperty('existing');
  });

  it('throws when admin.updateUserById returns an error', async () => {
    const admin: AuthAdmin = {
      getUserById: vi.fn(async () => ({ data: { user: null }, error: null })),
      updateUserById: vi.fn(async () => ({ data: null, error: new Error('boom') })),
    };
    await expect(
      updateEntitlements(admin, 'user-1', { subscription_plan: 'pro' }),
    ).rejects.toThrow('boom');
  });
});
