/**
 * Stripe Connect — create-or-bind the MC's connected account.
 *
 * Phase 2D.1 redesign. The route used to redirect to Stripe's hosted
 * onboarding (`AccountLink`). Now it returns just `{ accountId }`:
 * the client then mounts Stripe's embedded
 * `<ConnectAccountOnboarding>` component and fetches a session
 * `client_secret` from {@link account-session/route.ts}.
 *
 * Behaviour:
 * - First call for an MC → creates a fresh Express account, writes
 *   the binding into `app_metadata.stripe_connect_account_id` (via
 *   `updateEntitlements`), and seeds the `connect_accounts` mirror
 *   row.
 * - Re-call when an account is already bound → returns the existing
 *   `accountId`. Idempotent — repeat calls are safe.
 * - Re-call after a server-initiated disconnect where the row still
 *   has a `last_account_id` → rebinds that same Stripe account
 *   instead of creating a new one. (Vendor-initiated deauthorisation
 *   clears `last_account_id` so this path can't accidentally rebind
 *   a removed account.)
 *
 * Auth: required. Rate-limited at the auth-route level since this
 * mutates Stripe (creating an Express account isn't free or
 * reversible at scale).
 *
 * @module app/api/stripe/connect/route
 */
import { NextResponse } from 'next/server';

import { sendAlert } from '@/lib/alerts/send-alert';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import {
  stripeConnectAccountId,
  updateEntitlements,
} from '@/lib/auth/entitlements';
import {
  readConnectAccount,
  syncConnectAccount,
} from '@/lib/payments/connect-account';
import { stripe } from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 5 starts per minute per IP — onboarding kickoffs are rare in
// practice; this catches double-clicks + bots.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });

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

  try {
    // 1. Already bound? Hand back the existing ID.
    const existingFromMetadata = stripeConnectAccountId(user);
    if (existingFromMetadata) {
      return NextResponse.json({ accountId: existingFromMetadata });
    }

    // 2. Previous binding to re-link? Use last_account_id.
    const mirror = await readConnectAccount(user.id);
    const reuseId = mirror?.lastAccountId ?? null;

    let accountId: string;
    if (reuseId) {
      // Confirm the account is still usable on Stripe's side before
      // we re-bind. If Stripe 404s, the account no longer exists
      // (rare, but possible if Stripe-side cleanup ran) — fall
      // through to creating a fresh one.
      try {
        const account = await stripe.accounts.retrieve(reuseId);
        accountId = account.id;
      } catch {
        accountId = (await stripe.accounts.create({ type: 'express' })).id;
      }
    } else {
      const account = await stripe.accounts.create({ type: 'express' });
      accountId = account.id;
    }

    // 3. Seed the mirror + flip entitlements. `charges_enabled` is
    //    false at this point — Stripe will fire `account.updated`
    //    once the MC finishes onboarding inside the embedded
    //    component, and the webhook handler will flip the cheap-read
    //    boolean accordingly.
    await syncConnectAccount(user.id, {
      id: accountId,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });
    await updateEntitlements(
      createAdminClient().auth.admin,
      user.id,
      {
        stripe_connect_account_id: accountId,
        stripe_connect_enabled: false,
      },
    );

    return NextResponse.json({ accountId });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    await sendAlert({
      type: 'stripe_connect_onboarding_failed',
      severity: 'warn',
      userId: user.id,
      reason,
    });
    return NextResponse.json(
      { error: 'Could not start onboarding' },
      { status: 500 },
    );
  }
}
