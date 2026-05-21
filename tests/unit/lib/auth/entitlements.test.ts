import {
  accountType,
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

describe('entitlements — transition fallback to user_metadata', () => {
  /**
   * During the JWT-refresh window after the 0.8b backfill, a user's
   * session may still be carrying an old JWT with values only in
   * user_metadata. Those reads must keep working — otherwise live
   * users would lose admin / paid access mid-session until they
   * re-login. The fallback is intentionally generous; it's tightened
   * (removed) in a follow-up after a 24-48h soak.
   */
  it('reads from user_metadata when app_metadata is empty', () => {
    expect(isAdmin({ user_metadata: { account_type: 'admin' } })).toBe(true);
    expect(currentPlan({ user_metadata: { subscription_status: 'active', subscription_plan: 'pro' } })).toBe('pro');
  });

  it('handles null app_metadata gracefully', () => {
    expect(isAdmin({ app_metadata: null, user_metadata: { account_type: 'admin' } })).toBe(true);
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
