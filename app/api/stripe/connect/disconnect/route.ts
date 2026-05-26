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
 * 1. Hard-delete the `connect_accounts` mirror row via
 *    {@link deleteConnectBinding}. We don't preserve a
 *    `last_account_id` — that was an over-engineered convenience
 *    that turned into a footgun (accounts created against an
 *    un-activated platform stayed bound and rejected auth forever
 *    after activation). Express accounts are disposable + free; the
 *    next reconnect calls `accounts.create()` against the current
 *    platform state.
 * 2. Server-side `updateEntitlements()` to clear
 *    `stripe_connect_account_id` + `stripe_connect_enabled` from
 *    `app_metadata`.
 * 3. **The Stripe account itself is not deleted.** Stripe doesn't
 *    expose programmatic deletion for Express accounts; we drop
 *    the binding only. The vendor can fully remove our access
 *    inside their Stripe Dashboard, which triggers
 *    `account.application.deauthorized` and the webhook handler in
 *    `lib/payments/connect-events.ts` runs the same cleanup.
 *
 * Auth: required. Rate-limited (5/min/IP — disconnect is disruptive
 * enough that rapid-fire toggles deserve a brake).
 *
 * @module app/api/stripe/connect/disconnect/route
 */
import { NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { updateEntitlements } from '@/lib/auth/entitlements';
import { deleteConnectBinding } from '@/lib/payments/connect-account';
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

  // Phase: hard-delete the mirror row so the next /api/stripe/connect
  // kickoff creates a brand-new Express account.
  try {
    await deleteConnectBinding(user.id);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    logger.error('[stripe/connect/disconnect] deleteConnectBinding failed', undefined, {
      userId: user.id,
      detail,
    });
    return NextResponse.json(
      { error: 'Could not clear connect_accounts row', detail },
      { status: 500 },
    );
  }

  // Phase: clear entitlements in app_metadata.
  try {
    await updateEntitlements(createAdminClient().auth.admin, user.id, {
      stripe_connect_account_id: undefined,
      stripe_connect_enabled: false,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    logger.error('[stripe/connect/disconnect] updateEntitlements failed', undefined, {
      userId: user.id,
      detail,
    });
    return NextResponse.json(
      { error: 'Could not clear app_metadata entitlements', detail },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
