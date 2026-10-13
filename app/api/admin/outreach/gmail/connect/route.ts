/**
 * Start connecting the founder's outreach mailbox.
 *
 * `GET /api/admin/outreach/gmail/connect`: admin only. Mints a CSRF
 * `state`, pins it to this browser in a short-lived httpOnly cookie, and
 * redirects to Google's consent screen on the *outreach* OAuth client
 * (separate from the MC-facing client; see lib/outreach/gmail/client).
 *
 * @module app/api/admin/outreach/gmail/connect/route
 */
import { NextResponse } from 'next/server';

import { inMemoryLimiter } from '@/lib/api/rate-limit';
import { isAdmin } from '@/lib/auth/entitlements';
import { buildOutreachAuthorizeUrl } from '@/lib/outreach/gmail/client';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

/** Cookie pinning the outreach OAuth `state` to this browser. */
const STATE_COOKIE = 'zebri_outreach_oauth_state';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user)) return NextResponse.redirect(`${APP_URL}/login`);

  const { allowed } = await limiter.check(`outreachConnect:${user.id}`);
  if (!allowed) return new NextResponse('Too Many Requests', { status: 429 });

  const state = crypto.randomUUID();
  let url: string;
  try {
    url = buildOutreachAuthorizeUrl(state);
  } catch {
    return NextResponse.redirect(`${APP_URL}/admin/outreach?view=settings&mailbox=not_configured`);
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/admin/outreach/gmail',
    maxAge: 600,
  });
  return res;
}
