/**
 * Couple-facing payment-success page.
 *
 * Reached via Stripe's `success_url` redirect after a Checkout
 * session completes. The redirect URL carries
 * `?invoice_id=<id>&session_id={CHECKOUT_SESSION_ID}` (Stripe
 * substitutes the template variable server-side after the session
 * is created).
 *
 * Phase 2D.2 hardening — the success page was a static "thanks"
 * view with zero verification. An attacker could navigate here
 * with arbitrary query params and see "Payment successful" without
 * any payment having occurred. Real users would be confused; a
 * skilled scammer could screenshot it as social-engineering bait.
 *
 * What this page now verifies, server-side:
 *
 * 1. Both query params present + minimally well-formed.
 * 2. The invoice exists and is owned by an MC with a bound Connect
 *    account.
 * 3. `stripe.checkout.sessions.retrieve(session_id, { expand:
 *    ['payment_intent'] })` succeeds.
 * 4. The session's `metadata.invoice_id` matches the route param
 *    (so a session from a DIFFERENT invoice can't satisfy this
 *    one).
 * 5. The session's `metadata.connected_account_id` matches the
 *    invoice's MC vendor — closes a hypothetical "wrong vendor's
 *    session leaked into this URL" attack.
 * 6. The expanded `payment_intent.status === 'succeeded'` — no
 *    "open" or "requires_payment_method" sessions get a thank-you.
 *
 * On any verification failure → `notFound()` (renders the standard
 * 404 — never leak which dimension failed) plus a
 * `payment_success_param_tampered` Slack alert with the reason for
 * incident-response triage.
 *
 * Idempotent: this page is purely read-side. Refreshing it re-runs
 * the same checks. The invoice-status flip lives in the
 * `checkout.session.completed` webhook from Phase 2A, NOT here.
 *
 * @module app/invoice/payment-success/page
 */
import { CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { sendAlert } from '@/lib/alerts/send-alert';
import { stripeConnectAccountId } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

interface PageProps {
  // Next.js 16 — searchParams is a Promise in async server components.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const invoiceId = typeof params.invoice_id === 'string' ? params.invoice_id : null;
  const sessionId = typeof params.session_id === 'string' ? params.session_id : null;

  // Surface 404 for any missing / malformed param. No alert — bots
  // probing the URL would otherwise spam Slack. We only alert when
  // both params look syntactically real but fail server-side
  // verification (a more specific signal of tampering).
  if (!invoiceId || !sessionId || !sessionId.startsWith('cs_')) {
    notFound();
  }

  // Read the invoice + look up the MC's connected account. We use
  // the service-role client because this surface is unauthenticated
  // (the session_id from Stripe's redirect *is* the capability).
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, user_id, status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!invoice) {
    await alertTamper(invoiceId, sessionId, 'invoice not found');
    notFound();
  }

  const {
    data: { user },
  } = await admin.auth.admin.getUserById(invoice.user_id);
  const expectedAccountId = user ? stripeConnectAccountId(user) : null;
  if (!expectedAccountId) {
    await alertTamper(invoiceId, sessionId, 'MC has no Connect account');
    notFound();
  }

  // Verify the session against Stripe itself.
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    await alertTamper(invoiceId, sessionId, `stripe retrieve failed: ${reason}`);
    notFound();
  }

  // Cross-checks against the session payload.
  const metaInvoiceId = session.metadata?.invoice_id ?? null;
  const metaAccountId = session.metadata?.connected_account_id ?? null;
  if (metaInvoiceId !== invoiceId) {
    await alertTamper(invoiceId, sessionId, 'session.metadata.invoice_id mismatch');
    notFound();
  }
  if (metaAccountId !== expectedAccountId) {
    await alertTamper(invoiceId, sessionId, 'session.metadata.connected_account_id mismatch');
    notFound();
  }

  // payment_intent was expanded above; if it's null or non-succeeded,
  // the session never resulted in a real charge.
  const pi =
    session.payment_intent && typeof session.payment_intent === 'object'
      ? session.payment_intent
      : null;
  if (!pi || pi.status !== 'succeeded') {
    await alertTamper(invoiceId, sessionId, `payment_intent status=${pi?.status ?? 'absent'}`);
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
      <div className="bg-surface rounded-card border border-border shadow-sm p-10 max-w-sm w-full text-center">
        <CheckCircle2
          className="w-12 h-12 text-success mx-auto mb-4"
          strokeWidth={1.5}
        />
        <h1 className="text-section font-semibold text-text mb-2">
          Payment successful
        </h1>
        <p className="text-body text-text-muted">
          Thank you — your payment has been received. You&apos;ll get a
          confirmation by email shortly.
        </p>
      </div>
    </div>
  );
}

/**
 * Slack-alert helper for the various tamper paths. Single helper
 * keeps the alert shape consistent across all 5 failure branches.
 */
async function alertTamper(
  invoiceToken: string,
  sessionId: string,
  reason: string,
): Promise<void> {
  await sendAlert({
    type: 'payment_success_param_tampered',
    severity: 'warn',
    invoiceToken,
    sessionId,
    reason,
  });
}
