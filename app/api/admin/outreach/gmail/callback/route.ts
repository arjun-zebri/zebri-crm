/**
 * Finish connecting the outreach mailbox.
 *
 * `GET /api/admin/outreach/gmail/callback?code&state`: verifies the
 * signed-in user is an admin and that `state` matches the cookie set by
 * the connect route (CSRF), exchanges the code, confirms both Gmail
 * scopes were granted, and stores the refresh token encrypted. The token
 * never reaches the browser.
 *
 * @module app/api/admin/outreach/gmail/callback/route
 */
import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { recordAdminAction } from '@/lib/admin/audit';
import { logger } from '@/lib/alerts/logger';
import { isAdmin } from '@/lib/auth/entitlements';
import { encryptSecret } from '@/lib/crypto/secret-box';
import { exchangeOutreachCode, GmailClient, OUTREACH_SCOPES } from '@/lib/outreach/gmail/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const STATE_COOKIE = 'zebri_outreach_oauth_state';

function back(result: string): NextResponse {
  const res = NextResponse.redirect(`${APP_URL}/admin/outreach?view=settings&mailbox=${result}`);
  res.cookies.delete({ name: STATE_COOKIE, path: '/api/admin/outreach/gmail' });
  return res;
}

function sameState(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user)) return NextResponse.redirect(`${APP_URL}/login`);

  const params = request.nextUrl.searchParams;
  if (params.get('error')) return back('denied');
  if (!sameState(params.get('state'), request.cookies.get(STATE_COOKIE)?.value)) return back('error');
  const code = params.get('code');
  if (!code) return back('error');

  try {
    const tokens = await exchangeOutreachCode(code);
    const missing = OUTREACH_SCOPES.filter((s) => s.startsWith('https://') && !tokens.scopes.includes(s));
    // Without readonly, replies go undetected and follow-ups keep sending.
    if (missing.length) return back('missing_scope');
    if (!tokens.refreshToken) return back('no_refresh_token');
    const email = await new GmailClient(tokens.accessToken).profileEmail();

    const admin = createAdminClient();
    const { error } = await admin.from('outreach_mailbox').upsert({
      id: true,
      email,
      refresh_token_enc: encryptSecret(tokens.refreshToken),
      scopes: tokens.scopes,
      connected_at: new Date().toISOString(),
      last_error: null,
    });
    if (error) throw new Error(error.message);
    await recordAdminAction({ actorId: user.id, targetUserId: null, action: 'outreach_mailbox_connect', details: { email } });
    return back('connected');
  } catch (err) {
    logger.error('[outreach] mailbox connect failed', err);
    return back('error');
  }
}
