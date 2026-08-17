/**
 * Start the "connect your own mailbox" OAuth dance.
 *
 * `GET /api/oauth/authorize?provider=google|microsoft` — for the signed-in
 * MC, generate a CSRF `state`, stash it in a short-lived httpOnly cookie,
 * and 302-redirect the browser to the provider's consent screen. The
 * callback ({@link app/api/oauth/callback/route}) verifies the state and
 * stores the returned tokens.
 *
 * @module app/api/oauth/authorize/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter } from '@/lib/api/rate-limit';
import { buildAuthorizeUrl, isOAuthProvider } from '@/lib/oauth/providers';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

/** Cookie that pins the OAuth `state` to this browser (CSRF defence). */
export const OAUTH_STATE_COOKIE = 'zebri_oauth_state';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const { allowed } = await limiter.check(`oauthAuthorize:${user.id}`);
  if (!allowed) return new NextResponse('Too Many Requests', { status: 429 });

  const provider = request.nextUrl.searchParams.get('provider');
  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(`${APP_URL}/settings?tab=public&oauth=error`);
  }

  // state = "<provider>.<random>" — the callback reads the provider back
  // out and checks the whole string against the cookie.
  const state = `${provider}.${crypto.randomUUID()}`;
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(provider, state);
  } catch (err) {
    // Missing client credentials for this provider (a deploy-config gap,
    // not a user mistake). A raw 500 here strands the MC on a blank error
    // page; bounce them back to settings so the UI can explain instead.
    logger.error('[oauth/authorize] provider not configured', {
      userId: user.id,
      provider,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    });
    return NextResponse.redirect(`${APP_URL}/settings?tab=public&oauth=error`);
  }
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
