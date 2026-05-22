/**
 * Stripe Checkout session creation.
 *
 * POST `/api/stripe/checkout` — creates a Stripe Checkout session
 * for a logged-in MC to subscribe to Pro or Max. Returns
 * `{ url }` for the frontend to redirect to. Beta users get the
 * lifetime-discount price via the entitlements helper.
 *
 * Hardened in Phase 2A:
 * - **Zod-validated body** (`{ plan: 'pro' | 'max' }`); anything
 *   else returns 400 with sanitised issues.
 * - **Rate-limited** to 5/min/user via {@link STRIPE_RATE_LIMITS}.
 *   Hits fire `stripe_rate_limit_hit` so we see scripted abuse in
 *   Slack.
 * - **TSDoc** + structured logger replacing `console.error`.
 *
 * @module app/api/stripe/checkout/route
 */
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf, STRIPE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import {
  isBetaUser,
  stripeCustomerId,
  updateEntitlements,
} from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  plan: z.enum(['pro', 'max']),
});

const limiter = inMemoryLimiter(STRIPE_RATE_LIMITS.checkout);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Per-user rate-limit (logged in, so keying on user.id beats IP).
  const { allowed, retryAfter } = await limiter.check(`checkout:${user.id}`);
  if (!allowed) {
    await sendAlert({
      type: 'stripe_rate_limit_hit',
      severity: 'warn',
      action: 'checkout',
      ip: ipOf(request),
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'Too many checkout attempts. Try again in a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      },
    );
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { plan } = parsed.data;

  // Entitlement flag — read via the helper so a user can't grant
  // themselves the beta price by setting user_metadata.is_beta_user.
  const isBeta = isBetaUser(user);
  const priceId = isBeta
    ? process.env.STRIPE_BETA_PRICE_ID
    : plan === 'max'
      ? process.env.STRIPE_MAX_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    const missing = isBeta
      ? 'STRIPE_BETA_PRICE_ID'
      : plan === 'max'
        ? 'STRIPE_MAX_PRICE_ID'
        : 'STRIPE_PRO_PRICE_ID';
    logger.error('[stripe/checkout] missing env var', { missing });
    return NextResponse.json({ error: 'Plan not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    // Resolve or create the Stripe customer up-front so the
    // stripe_customers lookup row exists before any webhook fires.
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let customerId = stripeCustomerId(user);
    if (!customerId) {
      // Reuse any existing lookup row (e.g. from an abandoned
      // checkout) so we never create more than one Stripe customer
      // per user.
      const { data: existing } = await adminClient
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      customerId = (existing?.stripe_customer_id as string | undefined) ?? undefined;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await adminClient
        .from('stripe_customers')
        .upsert(
          { stripe_customer_id: customerId, user_id: user.id },
          { onConflict: 'stripe_customer_id' },
        );
    }

    // Persist on the auth user so the next checkout attempt (e.g. if
    // the user abandons Stripe Checkout) doesn't create another
    // customer. Lives in app_metadata (server-managed identity).
    if (stripeCustomerId(user) !== customerId) {
      await updateEntitlements(adminClient.auth.admin, user.id, {
        stripe_customer_id: customerId,
      });
    }

    // Free trials removed in Phase 1 — Starter (5-couple cap) is the
    // only free tier. Stripe checkout charges from day 1.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
      metadata: { plan },
      success_url: `${baseUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${baseUrl}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('[stripe/checkout] session create failed', {
      userId: user.id,
      plan,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
