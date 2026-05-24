/**
 * Disconnect — close the §7.4 escalation hole that the previous
 * client-side disconnect (`supabase.auth.updateUser({ data: ... })`)
 * left open.
 *
 * The old flow let any authenticated MC clear or set
 * `user_metadata.stripe_connect_account_id` directly — which sounds
 * harmless ("they're just clearing their own field") but the entire
 * §7.4 fix turns on the principle that **trust-level fields live in
 * `app_metadata`, never `user_metadata`**. Allowing client-side
 * writes to *any* Stripe-related field reopens the door on
 * convention.
 *
 * The fix:
 * 1. Server-side `updateEntitlements()` to clear
 *    `stripe_connect_account_id` + `stripe_connect_enabled` from
 *    `app_metadata`.
 * 2. Move the live account_id to `last_account_id` in the
 *    `connect_accounts` mirror so a future re-connect can rebind
 *    the same Stripe account.
 * 3. **The Stripe account itself is not deleted.** Stripe doesn't
 *    expose programmatic deletion for Express accounts; we just
 *    drop the binding. The vendor can fully remove our access
 *    inside their Stripe Dashboard, which triggers
 *    `account.application.deauthorized` and the webhook clears
 *    `last_account_id`.
 *
 * Auth: required. Rate-limited at the auth-route level (disconnect
 * is disruptive enough that rapid-fire toggles deserve a brake).
 *
 * @module app/api/stripe/connect/disconnect/route
 */
import { NextResponse } from 'next/server';

import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import {
  stripeConnectAccountId,
  updateEntitlements,
} from '@/lib/auth/entitlements';
import { clearConnectBinding } from '@/lib/payments/connect-account';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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
    const accountId = stripeConnectAccountId(user);
    if (accountId) {
      // Preserve the previous binding so a re-connect can rebind
      // without creating a new Stripe account. The
      // `account.application.deauthorized` webhook clears it if
      // the vendor explicitly removes our platform.
      await clearConnectBinding(user.id, { preserveLastAccountId: true });
    }

    await updateEntitlements(
      createAdminClient().auth.admin as never,
      user.id,
      {
        stripe_connect_account_id: undefined,
        stripe_connect_enabled: false,
      },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Could not disconnect',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
