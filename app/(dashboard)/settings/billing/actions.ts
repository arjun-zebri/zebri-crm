/**
 * Billing tab server actions.
 *
 * Plan changes (upgrade / downgrade) hand off to Stripe's hosted
 * Customer Portal in the `subscription_update_confirm` flow, Stripe
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
 * Phase 2B: all four actions are now rate-limited per-user via
 * {@link STRIPE_RATE_LIMITS}. Hits fire `stripe_rate_limit_hit`
 * with the specific action name so we can tell scripted abuse from
 * a stuck retry loop in our own UI.
 *
 * `current_period_end` reads go through {@link readPeriodEndIso}
 * (single source of truth for the items-first / root-fallback
 * pattern Stripe forces on us).
 *
 * @module app/(dashboard)/settings/billing/actions
 */
'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import {
  inMemoryLimiter,
  ipOfHeaders,
  STRIPE_RATE_LIMITS,
} from '@/lib/api/rate-limit';
import { stripeCustomerId, stripeSubscriptionId, updateEntitlements } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { readPeriodEndIso } from '@/lib/payments/webhook-events';
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

/**
 * Limiters live at module scope so the bucket persists across
 * action invocations within the same Node process (Vercel keeps
 * a function warm for ~15 min). Cold-start drops the bucket;
 * that's acceptable, the limiter exists to stop accidental
 * loops + naive abuse, not determined attackers (who'd hit the
 * Stripe API rate-limit before our cap mattered anyway).
 */
const limiters = {
  cancelSubscription: inMemoryLimiter(STRIPE_RATE_LIMITS.cancelSubscription),
  resumeSubscription: inMemoryLimiter(STRIPE_RATE_LIMITS.resumeSubscription),
  changePlan: inMemoryLimiter(STRIPE_RATE_LIMITS.changePlan),
  paymentMethod: inMemoryLimiter(STRIPE_RATE_LIMITS.paymentMethod),
} as const;

type LimiterKey = keyof typeof limiters;

/**
 * Apply the per-user limit for `action`. Returns the error string
 * to surface when blocked, or `null` when allowed. Fires
 * `stripe_rate_limit_hit` on a hit (fire-and-forget; alert errors
 * must not break the billing flow).
 */
async function applyBillingRateLimit(
  action: LimiterKey,
  userId: string,
): Promise<string | null> {
  const result = await limiters[action].check(`${action}:${userId}`);
  if (result.allowed) return null;
  const hdrs = await headers();
  void sendAlert({
    type: 'stripe_rate_limit_hit',
    severity: 'warn',
    action,
    ip: ipOfHeaders(hdrs),
    userId,
  });
  return 'Too many requests. Please wait a moment and try again.';
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
 * Use this for both upgrade (Pro → Max) and downgrade (Max → Pro):
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

  const limitError = await applyBillingRateLimit('changePlan', user.id);
  if (limitError) return { error: limitError };

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
 * response, the UI doesn't have to wait on the webhook to render
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

  const limitError = await applyBillingRateLimit('cancelSubscription', user.id);
  if (limitError) return { error: limitError };

  const subId = stripeSubscriptionId(user);
  if (!subId) return { error: 'No active subscription to cancel.' };

  try {
    const updated = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    });

    const subscriptionEnd = readPeriodEndIso(
      updated as unknown as Parameters<typeof readPeriodEndIso>[0],
    );

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
 * re-populates `subscription_end` with the next renewal date.
 */
export async function resumeSubscriptionAction(): Promise<BillingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const limitError = await applyBillingRateLimit('resumeSubscription', user.id);
  if (limitError) return { error: limitError };

  const subId = stripeSubscriptionId(user);
  if (!subId) return { error: 'No subscription to resume.' };

  try {
    const updated = await stripe.subscriptions.update(subId, { cancel_at_period_end: false });

    // For an active sub, subscription_end now represents the next
    // renewal date (shown on the plan card as "Renews on …").
    const subscriptionEnd = readPeriodEndIso(
      updated as unknown as Parameters<typeof readPeriodEndIso>[0],
    );

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

  const limitError = await applyBillingRateLimit('paymentMethod', user.id);
  if (limitError) return { error: limitError };

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
