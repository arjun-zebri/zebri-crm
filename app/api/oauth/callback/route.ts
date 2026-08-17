/**
 * Finish the "connect your own mailbox" OAuth dance.
 *
 * `GET /api/oauth/callback?code&state` — the provider redirects here after
 * the MC consents. We verify the `state` against the cookie set by
 * {@link app/api/oauth/authorize/route} (CSRF), exchange the code for
 * tokens, look up the connected address, encrypt + persist everything to
 * `user_public_settings`, and bounce back to settings with a status flag.
 *
 * The MC is identified by their existing Supabase session, so the tokens
 * always bind to the right user.
 *
 * @module app/api/oauth/callback/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter } from '@/lib/api/rate-limit';
import { encryptSecret } from '@/lib/crypto/secret-box';
import { isOAuthProvider } from '@/lib/oauth/providers';
import { exchangeCode, fetchUserEmail } from '@/lib/oauth/tokens';
import { createClient } from '@/lib/supabase/server';

import { OAUTH_STATE_COOKIE } from '../authorize/route';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

const settingsUrl = (status: 'connected' | 'error') =>
  `${APP_URL}/settings?tab=public&oauth=${status}`;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // The MC declined, or the provider returned an error.
  if (params.get('error')) return NextResponse.redirect(settingsUrl('error'));

  const code = params.get('code');
  const state = params.get('state');
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  // Constant-ish CSRF check: the round-tripped state must equal the cookie.
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(settingsUrl('error'));
  }
  const provider = state.split('.')[0];
  if (!isOAuthProvider(provider)) return NextResponse.redirect(settingsUrl('error'));

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
    return res;
  } catch (err) {
    // Supabase/PostgREST failures throw plain objects, not Errors —
    // serialise them fully so the log shows the code/details, not
    // "[object Object]".
    logger.error('[oauth/callback] connect failed', {
      userId: user.id,
      provider,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    });
    return NextResponse.redirect(settingsUrl('error'));
  }
}
