/**
 * Stripe Customer Portal session creation.
 *
 * POST `/api/stripe/portal` — creates a one-shot link into Stripe's
 * Customer Portal for the logged-in MC to manage their subscription
 * (update payment method, view invoices, change plan via Stripe's
 * hosted UI). Returns `{ url }` for redirect.
 *
 * Plan-change flows that open the portal in a specific mode (e.g.
 * `subscription_update_confirm`) live in the billing server actions
 * (`createPlanChangeSessionAction`), not here. This route is the
 * vanilla "open portal" endpoint.
 *
 * Hardened in Phase 2A:
 * - **Rate-limited** to 10/min/user via {@link STRIPE_RATE_LIMITS}.
 * - **TSDoc** + structured logger.
 *
 * No body schema (POST with empty body); a future variant taking a
 * `{ flow }` discriminator can extend this when it lands.
 *
 * @module app/api/stripe/portal/route
 */
import { NextResponse, type NextRequest } from 'next/server';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf, STRIPE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { stripeCustomerId } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createClient } from '@/lib/supabase/server';

const limiter = inMemoryLimiter(STRIPE_RATE_LIMITS.portal);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfter } = await limiter.check(`portal:${user.id}`);
  if (!allowed) {
    await sendAlert({
      type: 'stripe_rate_limit_hit',
      severity: 'warn',
      action: 'portal',
      ip: ipOf(request),
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'Too many portal requests. Try again in a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      },
    );
  }

  const customerId = stripeCustomerId(user);
  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings?tab=billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('[stripe/portal] session create failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
