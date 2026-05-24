/**
 * Account Session creation for the embedded Connect onboarding.
 *
 * The Stripe `<ConnectAccountOnboarding>` / `<ConnectAccountManagement>`
 * components need a fresh Account Session client_secret on every
 * render. The session ties the embedded UI to the connected account
 * and gates which components the MC is allowed to interact with —
 * we enable `account_onboarding` + `account_management` +
 * `notification_banner` (the trio the settings page mounts).
 *
 * Account Sessions are short-lived (expire after the SDK uses them),
 * so the client calls this route via `fetchClientSecret` on every
 * mount.
 *
 * Auth: required + must already have a bound Stripe account
 * (`stripe_connect_account_id` in `app_metadata`). Returning 400
 * when no account is bound surfaces a clear path back to the kickoff
 * route at `/api/stripe/connect`.
 *
 * @module app/api/stripe/connect/account-session/route
 */
import { NextResponse } from 'next/server';

import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { stripeConnectAccountId } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { createClient } from '@/lib/supabase/server';

// 30 / min / IP — onboarding + management both re-fetch on remount,
// and the embedded SDK may call repeatedly during a single session
// as the iframe initialises. 30 is comfortably above the genuine
// max-per-flow but still tight enough to stop runaway loops.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 30 });

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
    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
        notification_banner: { enabled: true },
      },
    });
    return NextResponse.json({ client_secret: session.client_secret });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Could not create account session',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
