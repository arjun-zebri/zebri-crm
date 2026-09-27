/**
 * `POST /api/unsubscribe`: confirms an email opt-out.
 *
 * The one write path behind the public `/unsubscribe/[token]` page. Public,
 * unauthenticated (the Spam Act Regulations forbid requiring a login here),
 * and token-gated by a signed {@link createUnsubscribeToken} rather than a
 * DB-stored token; see `lib/email/unsubscribe-token.ts` for why.
 *
 * WHY THIS IS A SEPARATE POST FROM THE GET PAGE. Opening the emailed link is
 * a `GET` on `/unsubscribe/[token]`, and mailbox providers, corporate link
 * scanners and antivirus proxies routinely pre-fetch every link in an email
 * before a person ever sees it. If that `GET` itself unsubscribed the
 * address, a scanner would silently opt people out of mail they never
 * touched. RFC 8058 draws the same line: only a `POST` may change state: so
 * the page only *reads* (renders a confirmation with one button), and this
 * route is the sole place a write happens, reachable only by a real
 * confirming submit. That is also "one click": the person's one deliberate
 * action is clicking the button that submits this form, not the act of
 * opening the email.
 *
 * The mailbox provider's RFC 8058 one-click POST does not come here: it
 * goes to the URL in the `List-Unsubscribe` header,
 * `POST /api/unsubscribe/[token]` (the token is in the path, because a
 * one-click POST carries only `List-Unsubscribe=One-Click` in its body).
 * Both routes record the opt-out through the same `recordUnsubscribe`.
 *
 * The write is a plain HTML form POST (`action="/api/unsubscribe"`), not a
 * `fetch` call, so the page needs no client JS at all, and works exactly
 * the same on a stripped-down mail-client in-app browser. On success this
 * redirects (303, so a page refresh can't replay the POST) back to the GET
 * page, which then reads the fresh DB state and renders "you're
 * unsubscribed": the second-click-is-harmless path, since the row is
 * already there and the page shows the done state instead of the form.
 *
 * @module app/api/unsubscribe/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf, UNSUBSCRIBE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { parseFormDataBody } from '@/lib/api/validate';
import { recordUnsubscribe } from '@/lib/email/record-unsubscribe';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';

/**
 * Per-IP cap on invalid-token attempts per minute, on top of the shared
 * hourly cap in `recordInvalidTokenAttempt`. Checked only once a token
 * has failed verification: a valid token is never limited.
 */
const limiter = inMemoryLimiter(UNSUBSCRIBE_RATE_LIMITS.confirm);

const bodySchema = z.object({
  token: z.string().trim().min(1).max(4096),
});

function pageUrl(
  request: NextRequest,
  token: string,
  error?: 'invalid' | 'rate_limited' | 'write_failed',
): URL {
  const url = new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url);
  if (error) url.searchParams.set('error', error);
  return url;
}

/**
 * Confirm an opt-out from the public page's form. Always answers with a
 * 303 back to the page, carrying `?error=` when the token was invalid,
 * the IP was rate-limited for sending too many invalid tokens (a valid
 * token is never rate-limited), or the write failed.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseFormDataBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { token } = parsed.data;

  // Verify first, and never rate-limit a valid token (Task 15c): the
  // write is idempotent and keyed by the token's own address, so a repeat
  // is harmless, and refusing it would drop a real opt-out. Only invalid
  // tokens count toward the per-IP limits, through the same shared
  // invalid-attempt limiter every other public-token surface uses, so
  // scripted enumeration here trips the same burst alert as the others.
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    const ip = ipOf(request);
    const attempt = await recordInvalidTokenAttempt({ ip, surface: 'unsubscribe' });
    const burst = await limiter.check(ip);
    if (!attempt.allowed || !burst.allowed) {
      const retryAfter = burst.allowed ? attempt.retryAfter : burst.retryAfter;
      return NextResponse.redirect(pageUrl(request, token, 'rate_limited'), {
        status: 303,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      });
    }
    return NextResponse.redirect(pageUrl(request, token, 'invalid'), { status: 303 });
  }

  // The same write the RFC 8058 one-click route makes; see
  // `lib/email/record-unsubscribe.ts`. A failure is alerted there, and the
  // page is told so it can say the opt-out did not go through rather than
  // silently showing the form again.
  const recorded = await recordUnsubscribe(payload, 'form');
  if (!recorded.ok) {
    return NextResponse.redirect(pageUrl(request, token, 'write_failed'), { status: 303 });
  }

  return NextResponse.redirect(pageUrl(request, token), { status: 303 });
}
