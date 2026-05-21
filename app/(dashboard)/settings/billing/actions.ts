/**
 * Billing tab server actions.
 *
 * Subscription lifecycle changes (plan switch, cancel, resume) used to
 * route through the Stripe-hosted Customer Portal, which has no
 * automatic return UX — users got stuck on Stripe with no signal back
 * to the app. These actions call the Stripe API directly so the
 * change happens in-place, the modal closes, and the page reloads
 * once the webhook has updated `app_metadata`.
 *
 * Payment-method updates still route to the Stripe Portal (cards
 * belong on Stripe's PCI surface, and we deep-link to the
 * `payment_method_update` flow so the user doesn't see the full
 * portal).
 *
 * Each action returns a tagged result the client uses to drive the
 * post-action polling banner.
 *
 * @module app/(dashboard)/settings/billing/actions
 */
'use server';

import { stripeCustomerId, stripeSubscriptionId } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createClient } from '@/lib/supabase/server';

export interface BillingActionResult {
  ok?: true;
  error?: string;
}

function priceFor(plan: 'pro' | 'max'): string | undefined {
  return plan === 'max' ? process.env.STRIPE_MAX_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
}

/**
 * Switch the user's existing subscription to a different plan tier.
 * Uses `create_prorations` so the user gets the new tier immediately
 * and proration is credited/charged on the next invoice.
 */
export async function switchPlanAction(plan: 'pro' | 'max'): Promise<BillingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const subId = stripeSubscriptionId(user);
  if (!subId) return { error: 'No active subscription to switch.' };

  const targetPrice = priceFor(plan);
  if (!targetPrice) return { error: 'Plan not configured.' };

  try {
    const subscription = await stripe.subscriptions.retrieve(subId);
    const currentItem = subscription.items.data[0];
    if (!currentItem) return { error: 'Subscription has no items.' };
    if (currentItem.price.id === targetPrice) return { ok: true }; // no-op

    await stripe.subscriptions.update(subId, {
      items: [{ id: currentItem.id, price: targetPrice }],
      proration_behavior: 'create_prorations',
      // If the user had a scheduled cancellation, switching re-activates.
      cancel_at_period_end: false,
      metadata: { ...(subscription.metadata ?? {}), plan },
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to switch plan.' };
  }
}

/**
 * Schedule the user's subscription for cancellation at the end of the
 * current billing period. The user keeps access until then; the
 * `customer.subscription.updated` webhook lands and flips
 * `cancel_at_period_end: true` in `app_metadata`.
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
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to cancel.' };
  }
}

/**
 * Undo a scheduled cancellation — restores normal renewal.
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
    await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
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
export async function paymentMethodPortalAction(): Promise<{ ok?: true; url?: string; error?: string }> {
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
    return { ok: true, url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to open billing portal.' };
  }
}
