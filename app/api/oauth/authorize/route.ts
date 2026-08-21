/**
 * Start the OAuth dance for email or calendar access.
 *
 * `GET /api/oauth/authorize?provider=google|microsoft&purpose=email|calendar`
 * (plus an optional `&return=settings|calendar`): for the signed-in MC,
 * generate a CSRF `state`, stash it in a short-lived httpOnly cookie, and
 * 302-redirect the browser to the provider's consent screen. The callback ({@link app/api/oauth/callback/route}) verifies the
 * state and stores the returned tokens to `user_public_settings` (email) or
 * `calendar_connections` (calendar).
 *
 * @module app/api/oauth/authorize/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter } from '@/lib/api/rate-limit';
import {
  buildAuthorizeUrl,
  isOAuthProvider,
  isOAuthPurpose,
  isOAuthReturnTo,
} from '@/lib/oauth/providers';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

/** Cookie that pins the OAuth `state` to this browser (CSRF defence). */
export const OAUTH_STATE_COOKIE = 'zebri_oauth_state';

/**
 * Cookie carrying where to land after consent.
 *
 * Kept out of `state` so {@link parseOAuthState} and the constant-ish state
 * equality check stay untouched; this value is a UX detail, not part of the
 * CSRF token.
 */
export const OAUTH_RETURN_COOKIE = 'zebri_oauth_return';

/** Shared flags for both short-lived OAuth cookies. */
const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 600,
} as const;

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

  const purposeParam = request.nextUrl.searchParams.get('purpose') ?? 'email';
  if (!isOAuthPurpose(purposeParam)) {
    return NextResponse.redirect(`${APP_URL}/settings?tab=public&oauth=error`);
  }

  // Anything unrecognised falls back to Settings rather than erroring: a bad
  // `return` is a broken link, not a reason to deny an otherwise valid consent.
  const returnParam = request.nextUrl.searchParams.get('return');
  const returnTo = isOAuthReturnTo(returnParam) ? returnParam : 'settings';

  // state = "<provider>.<purpose>.<random>": the callback parses this to
  // know whether to store tokens in user_public_settings (email) or
  // calendar_connections (calendar), and where to redirect on success.
  const state = `${provider}.${purposeParam}.${crypto.randomUUID()}`;
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(provider, state, purposeParam);
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
  res.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);
  res.cookies.set(OAUTH_RETURN_COOKIE, returnTo, OAUTH_COOKIE_OPTIONS);
  return res;
}
