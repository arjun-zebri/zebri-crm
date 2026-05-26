/**
 * On-demand sync of the user's connected account from Stripe →
 * `connect_accounts` mirror.
 *
 * In production the `account.updated` webhook handler keeps the
 * mirror fresh — but the webhook has lag (Stripe doesn't fire it
 * synchronously), and in local dev without `stripe listen` it
 * never arrives at all. This route is the escape hatch: an
 * authenticated user can request a fresh pull from Stripe and have
 * the mirror updated immediately.
 *
 * Used by:
 * - The embedded onboarding component's `onExit` callback (so the
 *   moment the MC closes the form, we have fresh state without
 *   waiting on the webhook).
 * - A manual "Refresh" button on the status panel for users
 *   running locally without webhook forwarding.
 *
 * Auth: required + must already have a bound Stripe account.
 *
 * @module app/api/stripe/connect/sync/route
 */
import { NextResponse } from 'next/server';

import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { stripeConnectAccountId } from '@/lib/auth/entitlements';
import {
  type ConnectAccountSnapshot,
  syncConnectAccount,
} from '@/lib/payments/connect-account';
import { stripe } from '@/lib/payments/stripe';
import { createClient } from '@/lib/supabase/server';

// 10 / min / IP — manual refresh + onExit callback. The embedded
// onboarding completion can re-fire on rapid back-and-forth so we
// allow more than the kickoff route's 5/min cap.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const accountId = stripeConnectAccountId(user);
  if (!accountId) {
    return NextResponse.json(
      { error: 'No Connect account bound' },
      { status: 400 },
    );
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    // Coerce the Stripe.Account into the snapshot shape. The
    // `as Stripe.Account.BusinessType | null` cast on business_type
    // matches what the webhook handler does in connect-events.ts.
    const snapshot: ConnectAccountSnapshot = {
      id: account.id,
      charges_enabled: account.charges_enabled ?? null,
      payouts_enabled: account.payouts_enabled ?? null,
      details_submitted: account.details_submitted ?? null,
      default_currency: account.default_currency ?? null,
      country: account.country ?? null,
      business_type: account.business_type ?? null,
      requirements: account.requirements
        ? {
            currently_due: account.requirements.currently_due ?? null,
            past_due: account.requirements.past_due ?? null,
            disabled_reason: account.requirements.disabled_reason ?? null,
          }
        : null,
    };
    await syncConnectAccount(user.id, snapshot);

    // The mirror now has the latest from Stripe. The client should
    // re-fetch `/api/stripe/connect/status` to see it.
    return NextResponse.json({
      ok: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[stripe/connect/sync] failed', {
      userId: user.id,
      accountId,
      detail,
    });
    return NextResponse.json(
      { error: 'Could not sync from Stripe', detail },
      { status: 500 },
    );
  }
}
