/**
 * Couple-facing Stripe Checkout session creator for invoice payments.
 *
 * Called from the public `/invoice/[token]` page when a couple
 * clicks Pay with card. Token-gated (the couple must hold the
 * share-token URL); RLS-bypassing service-role read of the invoice
 * is justified because we're explicitly serving an unauthenticated
 * surface that proves possession of the share-token capability.
 *
 * Phase 2D.2 hardening:
 * - **Zod validation** on the request body (was manual presence
 *   checks); rejects malformed payloads with a 400.
 * - **Rate-limit** at the `public` category (10/min/IP) — abuse
 *   would mean someone hammering this endpoint to trigger Stripe
 *   API costs or enumerate token-vs-invoice pairings.
 * - **Structured logger** for the Stripe-failure path (was
 *   `console.error`).
 * - **`success_url` carries the Checkout session_id** as the
 *   `{CHECKOUT_SESSION_ID}` template var, so
 *   `/invoice/payment-success` can re-verify the session against
 *   Stripe server-side (next step in 2D.2 — closes the "tamper
 *   with the redirect URL" replay window).
 * - **`metadata.connected_account_id`** on the Checkout Session
 *   — the success-page verification asserts this matches the
 *   invoice's vendor account.
 *
 * Money model (unchanged): Separate Charges & Transfers — couple
 * is charged in full on the platform; funds transfer to the MC's
 * Connect account via `payment_intent_data.transfer_data.destination`.
 * No application fee (cleaner accounting; Zebri's cut comes from
 * the vendor's subscription, not a per-payment percentage).
 *
 * @module app/api/stripe/invoice-payment/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import {
  stripeConnectAccountId,
  stripeConnectEnabled,
} from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

// 10 requests per minute per IP — public route, money path.
// Tight enough to stop hammering, generous enough that a flaky
// network with retries from a real couple won't trip it.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

const bodySchema = z.object({
  invoiceId: z.string().uuid('Invoice ID must be a UUID'),
  shareToken: z.string().min(8, 'Share token is too short').max(200),
  paymentType: z.enum(['full', 'deposit', 'final']).default('full'),
});

export async function POST(request: NextRequest) {
  // Rate-limit before any DB / Stripe work so abuse is cheap to reject.
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { invoiceId, shareToken, paymentType } = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    logger.error('[stripe/invoice-payment] NEXT_PUBLIC_APP_URL not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createAdminClient();

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select(
      'id, title, subtotal, tax_rate, status, stripe_payment_enabled, share_token, user_id, couple_id, deposit_percent, deposit_paid_at',
    )
    .eq('id', invoiceId)
    .eq('share_token', shareToken)
    .maybeSingle();

  // Generic 404 for missing-OR-mismatched-token — never leak which
  // dimension failed (that would give an attacker a way to confirm
  // valid invoice IDs by varying the token alone).
  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (!invoice.stripe_payment_enabled) {
    return NextResponse.json(
      { error: 'Card payments not enabled for this invoice' },
      { status: 400 },
    );
  }
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Invoice cannot be paid' }, { status: 400 });
  }
  if (paymentType === 'final' && !invoice.deposit_paid_at) {
    return NextResponse.json(
      { error: 'Deposit must be paid before final balance' },
      { status: 400 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.admin.getUserById(invoice.user_id);
  if (userError || !user) {
    logger.error('[stripe/invoice-payment] MC account lookup failed', undefined, {
      invoiceId,
      userId: invoice.user_id,
    });
    return NextResponse.json({ error: 'MC account not found' }, { status: 500 });
  }

  // Connect identity via the helper closes §7.4 — even if the MC
  // sets stripe_connect_account_id in user_metadata, it's ignored.
  const connectedAccountId = stripeConnectAccountId(user);
  if (!connectedAccountId || !stripeConnectEnabled(user)) {
    return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 });
  }

  const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate ?? 0) / 100);
  const depositPct = invoice.deposit_percent ?? 50;

  let amountCents: number;
  let productName: string;
  if (paymentType === 'deposit') {
    amountCents = Math.round(total * (depositPct / 100) * 100);
    productName = `Deposit - ${invoice.title || 'Invoice'}`;
  } else if (paymentType === 'final') {
    amountCents = Math.round(total * ((100 - depositPct) / 100) * 100);
    productName = `Final Balance - ${invoice.title || 'Invoice'}`;
  } else {
    amountCents = Math.round(total * 100);
    productName = invoice.title || 'Invoice';
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: { name: productName },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: { destination: connectedAccountId },
      },
      // Metadata is what the post-payment webhook reads to advance
      // invoice state, and what the success-page re-verification
      // cross-checks against the route params. connected_account_id
      // closes a class of "what if the wrong vendor's session
      // gets returned?" attacks.
      metadata: {
        invoice_id: invoiceId,
        payment_type: paymentType,
        connected_account_id: connectedAccountId,
      },
      // `{CHECKOUT_SESSION_ID}` is a Stripe template variable —
      // Stripe substitutes the real session ID after creation. The
      // success page calls sessions.retrieve() with this to verify.
      success_url: `${appUrl}/invoice/payment-success?invoice_id=${invoiceId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/invoice/${shareToken}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('[stripe/invoice-payment] checkout.sessions.create failed', err instanceof Error ? err : undefined, {
      invoiceId,
      paymentType,
    });
    // Don't return the raw Stripe error to the couple — could leak
    // platform internals. Generic message + the request log carries
    // the detail.
    return NextResponse.json({ error: 'Payment setup failed' }, { status: 502 });
  }
}
