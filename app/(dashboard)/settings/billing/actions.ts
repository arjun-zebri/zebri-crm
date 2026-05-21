/**
 * Billing tab server actions.
 *
 * Plan changes (upgrade / downgrade) hand off to Stripe's hosted
 * Customer Portal in the `subscription_update_confirm` flow — Stripe
 * shows the user a confirmation page with the prorated amount, the
 * user accepts, and Stripe redirects back. Cancel / resume happen
 * in-place via the Stripe API and also update `app_metadata`
 * synchronously from Stripe's response so the UI doesn't have to
 * wait on the asynchronous webhook to populate `subscription_end`.
 *
 * Payment-method updates still route to the Stripe Portal (cards
 * belong on Stripe's PCI surface). We deep-link to the
 * `payment_method_update` flow so the user doesn't see the full
 * portal home.
 *
 * @module app/(dashboard)/settings/billing/actions
 */
'use server';

import { z } from 'zod';

import { stripeCustomerId, stripeSubscriptionId, updateEntitlements } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const planSchema = z.enum(['pro', 'max']);

export interface BillingActionResult {
  ok?: true;
  error?: string;
}

export interface BillingRedirectResult {
  url?: string;
  error?: string;
}

function priceFor(plan: 'pro' | 'max'): string | undefined {
  return plan === 'max' ? process.env.STRIPE_MAX_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
}

/**
 * Build a Stripe Customer Portal session deep-linked to the
 * `subscription_update_confirm` flow. Stripe shows the user the
 * prorated amount, they confirm, payment is collected (for upgrades)
 * or credit issued (for downgrades) per the portal's proration
 * settings, then Stripe redirects back to `/settings?tab=billing`.
 *
 * Use this for both upgrade (Pro → Max) and downgrade (Max → Pro) —
 * the portal handles both transparently.
 */
export async function createPlanChangeSessionAction(
  plan: 'pro' | 'max',
): Promise<BillingRedirectResult> {
  // Runtime validation: server actions can be called with arbitrary
  // shapes (TypeScript narrowing is compile-time only). Reject any
  // value outside the literal enum.
  const parsedPlan = planSchema.safeParse(plan);
  if (!parsedPlan.success) return { error: 'Invalid plan.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const customerId = stripeCustomerId(user);
  if (!customerId) return { error: 'No billing account found.' };
  const subId = stripeSubscriptionId(user);
  if (!subId) return { error: 'No active subscription to switch.' };

  const targetPrice = priceFor(parsedPlan.data);
  if (!targetPrice) return { error: 'Plan not configured.' };

  try {
    const subscription = await stripe.subscriptions.retrieve(subId);
    const currentItem = subscription.items.data[0];
    if (!currentItem) return { error: 'Subscription has no items.' };
    if (currentItem.price.id === targetPrice) {
      return { error: `You're already on the ${parsedPlan.data === 'max' ? 'Max' : 'Pro'} plan.` };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings?tab=billing&change=success`,
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: subId,
          items: [{ id: currentItem.id, price: targetPrice }],
        },
      },
    });

    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to start plan change.' };
  }
}

/**
 * Schedule the user's subscription for cancellation at the end of the
 * current billing period. Writes `cancel_at_period_end` and
 * `subscription_end` to `app_metadata` synchronously from Stripe's
 * response — the UI doesn't have to wait on the webhook to render
 * the grace-period end date.
 *
 * The webhook still fires asynchronously and re-writes the same
 * fields (idempotent), so the eventual-consistency story is intact.
 */
export async function cancelSubscriptionAction(): Promise<BillingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const subId = stripeSubscriptionId(user);
  if (!subId) return { error: 'No active subscription to cancel.' };

  try {
    const updated = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    });

    // `current_period_end` is on the SubscriptionItem in current
    // Stripe API versions (it used to be a top-level field on the
    // Subscription itself). Read from the first item with a
    // fallback to the top-level field for older API versions; the
    // cast is the cheapest cross-version read.
    type WithPeriodEnd = { current_period_end?: number };
    const firstItem = updated.items.data[0] as unknown as WithPeriodEnd | undefined;
    const periodEnd =
      firstItem?.current_period_end ?? (updated as unknown as WithPeriodEnd).current_period_end;
    const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined;

    const admin = createAdminClient();
    await updateEntitlements(admin.auth.admin, user.id, {
      cancel_at_period_end: true,
      ...(subscriptionEnd ? { subscription_end: subscriptionEnd } : {}),
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to cancel.' };
  }
}

/**
 * Undo a scheduled cancellation. Clears `cancel_at_period_end` and
 * `subscription_end` in `app_metadata` synchronously.
 */
export async function resumeSubscriptionAction(): Promise<BillingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const subId = stripeSubscriptionId(user);
  if (!subId) return { error: 'No subscription to resume.' };

  try {
    const updated = await stripe.subscriptions.update(subId, { cancel_at_period_end: false });

    // Keep subscription_end populated — for an active sub it
    // represents the next renewal date now.
    type WithPeriodEnd = { current_period_end?: number };
    const firstItem = updated.items.data[0] as unknown as WithPeriodEnd | undefined;
    const periodEnd =
      firstItem?.current_period_end ?? (updated as unknown as WithPeriodEnd).current_period_end;
    const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined;

    const admin = createAdminClient();
    await updateEntitlements(admin.auth.admin, user.id, {
      cancel_at_period_end: false,
      ...(subscriptionEnd ? { subscription_end: subscriptionEnd } : {}),
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to resume.' };
  }
}

/**
 * Create a Stripe Portal session deep-linked to the payment-method
 * update flow. Used by the "Update payment method" link on the
 * billing card. Cards belong on Stripe's PCI surface, so this one
 * keeps the portal-roundtrip pattern.
 */
export async function paymentMethodPortalAction(): Promise<BillingRedirectResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const customerId = stripeCustomerId(user);
  if (!customerId) return { error: 'No billing account found.' };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings?tab=billing`,
      flow_data: { type: 'payment_method_update' },
    });
    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to open billing portal.' };
  }
}
