/**
 * Billing-state fixtures.
 *
 * Phase 1's user-facing ask: "test every possible billing scenario."
 * This helper provisions a real auth user in each canonical state so
 * tests can assert UI behaviour, helper return values, middleware
 * paywall routing, and Postgres-function gating uniformly.
 *
 * Each state mirrors what the Stripe webhook would land in
 * `app_metadata` for that lifecycle event — but we set it directly
 * via the admin API so the tests don't need a real Stripe flow.
 *
 * @module tests/integration/helpers/billing-states
 */
import { createTestUser, type TestUser } from './supabase';

export type BillingState =
  | 'never_trialled'
  | 'trialing'
  | 'trial_expired'
  | 'active'
  | 'cancelling_in_grace'
  | 'past_due'
  | 'expired'
  | 'comped';

export type PlanId = 'starter' | 'pro' | 'max';

export interface BillingScenarioOptions {
  plan?: PlanId;
  /** ISO date for trial_end. Defaults to a sensible future/past per state. */
  trialEnd?: string;
  /** ISO date for subscription_end. Defaults to a sensible future/past per state. */
  subscriptionEnd?: string;
}

/** Build the `app_metadata` patch for a given billing state. */
export function appMetadataFor(state: BillingState, options: BillingScenarioOptions = {}) {
  const plan = options.plan ?? 'pro';
  const inFuture = options.trialEnd ?? new Date(Date.now() + 14 * 86_400_000).toISOString();
  const inPast = options.trialEnd ?? new Date(Date.now() - 86_400_000).toISOString();
  const subEndFuture =
    options.subscriptionEnd ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
  const subEndPast = options.subscriptionEnd ?? new Date(Date.now() - 86_400_000).toISOString();

  switch (state) {
    case 'never_trialled':
      return { account_type: 'vendor' };
    case 'trialing':
      return {
        account_type: 'vendor',
        subscription_status: 'trialing',
        subscription_plan: plan,
        trial_end: inFuture,
        is_subscribed: true,
      };
    case 'trial_expired':
      return {
        account_type: 'vendor',
        subscription_status: 'trialing',
        subscription_plan: plan,
        trial_end: inPast,
        is_subscribed: true,
      };
    case 'active':
      return {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: plan,
        is_subscribed: true,
        stripe_customer_id: 'cus_test_active',
        stripe_subscription_id: 'sub_test_active',
      };
    case 'cancelling_in_grace':
      return {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: plan,
        is_subscribed: true,
        subscription_end: subEndFuture,
        cancel_at_period_end: true,
        stripe_customer_id: 'cus_test_cancelling',
        stripe_subscription_id: 'sub_test_cancelling',
      };
    case 'past_due':
      return {
        account_type: 'vendor',
        subscription_status: 'past_due',
        subscription_plan: plan,
        is_subscribed: false,
        stripe_customer_id: 'cus_test_pastdue',
        stripe_subscription_id: 'sub_test_pastdue',
      };
    case 'expired':
      return {
        account_type: 'vendor',
        subscription_status: 'expired',
        subscription_plan: plan,
        is_subscribed: false,
        subscription_end: subEndPast,
        stripe_customer_id: 'cus_test_expired',
        stripe_subscription_id: 'sub_test_expired',
      };
    case 'comped':
      return {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: plan,
        is_subscribed: true,
        is_comped: true,
      };
  }
}

/** Create a real auth user in the given billing state. */
export async function userInState(
  state: BillingState,
  options: BillingScenarioOptions = {},
): Promise<TestUser> {
  return createTestUser({}, appMetadataFor(state, options));
}
