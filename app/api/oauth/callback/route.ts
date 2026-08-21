/**
 * Finish the OAuth dance for email or calendar access.
 *
 * `GET /api/oauth/callback?code&state` — the provider redirects here after
 * the MC consents. We verify the `state` against the cookie set by
 * {@link app/api/oauth/authorize/route} (CSRF), exchange the code for
 * tokens, and persist them to `user_public_settings` (email) or
 * `calendar_connections` (calendar). The `state` encodes the purpose so
 * we know where to store and where to redirect on success.
 *
 * The MC is identified by their existing Supabase session, so the tokens
 * always bind to the right user.
 *
 * @module app/api/oauth/callback/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter } from '@/lib/api/rate-limit';
import { saveCalendarConnection } from '@/lib/calendar/connections';
import { encryptSecret } from '@/lib/crypto/secret-box';
import { isOAuthReturnTo, parseOAuthState } from '@/lib/oauth/providers';
import { exchangeCode, fetchUserEmail } from '@/lib/oauth/tokens';
import { createClient } from '@/lib/supabase/server';

import { OAUTH_RETURN_COOKIE, OAUTH_STATE_COOKIE } from '../authorize/route';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

const settingsUrl = (status: 'connected' | 'error') =>
  `${APP_URL}/settings?tab=public&oauth=${status}`;

/**
 * Where a calendar consent lands, honouring the allowlisted `return` cookie
 * set at authorize time. `settings` keeps the original destination so the
 * Settings card's existing `?calendar=` handling is unchanged.
 */
const calendarUrl = (status: 'connected' | 'error', returnTo: 'settings' | 'calendar') =>
  returnTo === 'calendar'
    ? `${APP_URL}/calendar?calendar=${status}`
    : `${APP_URL}/settings?tab=public&calendar=${status}`;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Read back the allowlisted destination up front, so even a declined consent
  // returns the MC to the page they started from. An absent or tampered cookie
  // just means Settings, never an attacker-chosen URL.
  const returnCookie = request.cookies.get(OAUTH_RETURN_COOKIE)?.value;
  const returnTo = isOAuthReturnTo(returnCookie) ? returnCookie : 'settings';

  // `return=calendar` is only ever set for a calendar consent, so it is enough
  // on its own to route the pre-state failures that cannot know the purpose.
  const abortUrl = returnTo === 'calendar' ? calendarUrl('error', 'calendar') : settingsUrl('error');

  // The MC declined, or the provider returned an error.
  if (params.get('error')) return NextResponse.redirect(abortUrl);

  const code = params.get('code');
  const state = params.get('state');
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  // Constant-ish CSRF check: the round-tripped state must equal the cookie.
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(abortUrl);
  }
  const parsed = parseOAuthState(state);
  if (!parsed) return NextResponse.redirect(abortUrl);
  const { provider, purpose } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const { allowed } = await limiter.check(`oauthCallback:${user.id}`);
  if (!allowed) return new NextResponse('Too Many Requests', { status: 429 });

  try {
    const tokens = await exchangeCode(provider, code);
    if (!tokens.refreshToken) {
      // Without a refresh token we can't keep sending after ~1h. Force the
      // MC to re-consent (Google needs prompt=consent, which we always set).
      throw new Error('provider did not return a refresh token');
    }
    const email = await fetchUserEmail(provider, tokens.accessToken);

    if (purpose === 'calendar') {
      await saveCalendarConnection(
        supabase,
        user.id,
        provider,
        { ...tokens, refreshToken: tokens.refreshToken },
        email,
      );
      const res = NextResponse.redirect(calendarUrl('connected', returnTo));
      res.cookies.delete(OAUTH_STATE_COOKIE);
      res.cookies.delete(OAUTH_RETURN_COOKIE);
      return res;
    }

    // purpose === 'email': existing user_public_settings upsert, unchanged.
    const { error } = await supabase.from('user_public_settings').upsert(
      {
        user_id: user.id,
        email_mode: 'oauth',
        oauth_provider: provider,
        oauth_email: email,
        oauth_refresh_token_encrypted: encryptSecret(tokens.refreshToken),
        oauth_access_token_encrypted: encryptSecret(tokens.accessToken),
        oauth_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        oauth_status: 'connected',
        oauth_last_error: null,
        oauth_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;

    const res = NextResponse.redirect(settingsUrl('connected'));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.delete(OAUTH_RETURN_COOKIE);
    return res;
  } catch (err) {
    // Supabase/PostgREST failures throw plain objects, not Errors —
    // serialise them fully so the log shows the code/details, not
    // "[object Object]".
    const redirectUrl =
      purpose === 'calendar' ? calendarUrl('error', returnTo) : settingsUrl('error');
    logger.error('[oauth/callback] connect failed', {
      userId: user.id,
      provider,
      purpose,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    });
    return NextResponse.redirect(redirectUrl);
  }
}
