/**
 * Read the current user's Connect account state.
 *
 * Wraps {@link readConnectAccount} so the settings page (a client
 * component) can fetch the mirror row's contents — capabilities,
 * requirements, disabled_reason — without going through Supabase
 * with a service-role key (the `connect_accounts` table is
 * service-role-only for writes; reads are RLS-scoped but the
 * client component still benefits from a server-side hop because
 * the mirror's shape might evolve over time and we don't want UI
 * callers reading raw columns).
 *
 * @module app/api/stripe/connect/status/route
 */
import { NextResponse } from 'next/server';

import { readConnectAccount } from '@/lib/payments/connect-account';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const state = await readConnectAccount(user.id);
  return NextResponse.json({ state });
}
