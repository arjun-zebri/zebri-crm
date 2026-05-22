/**
 * Stripe invoice/billing-history fetch.
 *
 * GET `/api/stripe/billing-history` — returns the last 12 invoices
 * + an optional "upcoming charge" preview for the logged-in MC.
 * Powers the Billing History list on the Settings → Billing tab.
 *
 * Hardened in Phase 2A:
 * - **Rate-limited** to 30/min/user via {@link STRIPE_RATE_LIMITS}.
 *   Read-only path so the limit is generous, but it protects
 *   Stripe's API quota from accidental loops on our side.
 * - **TSDoc** + structured logger replacing `console.error`.
 *
 * @module app/api/stripe/billing-history/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf, STRIPE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { stripeCustomerId, stripeSubscriptionId } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createClient } from '@/lib/supabase/server';

const limiter = inMemoryLimiter(STRIPE_RATE_LIMITS.billingHistory);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfter } = await limiter.check(`billingHistory:${user.id}`);
  if (!allowed) {
    await sendAlert({
      type: 'stripe_rate_limit_hit',
      severity: 'warn',
      action: 'billingHistory',
      ip: ipOf(request),
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'Too many requests. Try again in a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      },
    );
  }

  const customerId = stripeCustomerId(user);
  if (!customerId) {
    return NextResponse.json({ invoices: [], upcoming: null });
  }

  try {
    const list = await stripe.invoices.list({ customer: customerId, limit: 12 });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_paid || inv.amount_due,
      created: inv.created,
      hostedUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));

    // Upcoming-charge preview is best-effort. We never let it fail
    // the whole endpoint — the user still sees their history if
    // Stripe's preview API hiccups.
    let upcoming: { amount: number; nextChargeAt: number } | null = null;
    try {
      const subId = stripeSubscriptionId(user);
      if (subId) {
        const subscription = (await stripe.subscriptions.retrieve(subId)) as Stripe.Subscription & {
          current_period_end?: number;
        };
        if (
          (subscription.status === 'active' || subscription.status === 'trialing') &&
          !subscription.cancel_at_period_end
        ) {
          const upcomingInv = await stripe.invoices.createPreview({
            customer: customerId,
            subscription: subId,
          });
          upcoming = {
            amount: upcomingInv.amount_due,
            nextChargeAt:
              upcomingInv.next_payment_attempt ?? subscription.current_period_end ?? 0,
          };
        }
      }
    } catch (e) {
      logger.warn('[stripe/billing-history] upcoming preview failed', {
        userId: user.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return NextResponse.json({ invoices, upcoming });
  } catch (err) {
    logger.error('[stripe/billing-history] list failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load billing history' }, { status: 500 });
  }
}
