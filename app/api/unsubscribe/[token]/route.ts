/**
 * `/api/unsubscribe/[token]`: the URL every commercial automated email
 * advertises in its `List-Unsubscribe` header.
 *
 * WHY A SEPARATE URL FROM THE PAGE. RFC 8058 one-click unsubscribe (what
 * Gmail's and Yahoo's "Unsubscribe" button next to the sender name does)
 * POSTs `List-Unsubscribe=One-Click`, form-urlencoded, with no cookie and
 * no person in the loop, to exactly the URL in the header, and treats any
 * 2xx as done. The human page lives at `/unsubscribe/[token]`, and a Next
 * page cannot also hold a route handler: a form POST to a page is rendered
 * as the page, answers 200, and writes nothing. That is how Gmail used to
 * tell a couple they were unsubscribed while nothing was recorded. So the
 * header names this route handler instead, and the email footer keeps
 * linking to the page.
 *
 * - `POST` records the opt-out through the same `recordUnsubscribe` the
 *   page's confirm form uses. The token comes from the path, because the
 *   one-click body carries nothing else. The body is not required to be
 *   exactly `List-Unsubscribe=One-Click`: the signed token is the whole
 *   capability, and refusing a provider whose body differs slightly would
 *   only lose an opt-out someone asked for.
 * - `GET` never writes. Link scanners and prefetchers issue GETs, and a
 *   person may open the header URL by hand, so it redirects to the page,
 *   which asks them to confirm.
 *
 * Public and sessionless: `/api/unsubscribe` is on the middleware
 * `PUBLIC_ROUTES` list, which matches by prefix.
 *
 * @module app/api/unsubscribe/[token]/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf, UNSUBSCRIBE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { recordUnsubscribe } from '@/lib/email/record-unsubscribe';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';

/**
 * Per-IP cap on invalid-token attempts per minute, on top of the shared
 * hourly cap in `recordInvalidTokenAttempt`. Checked only once a token
 * has failed verification: a valid token is never limited.
 */
const limiter = inMemoryLimiter(UNSUBSCRIBE_RATE_LIMITS.confirm);

/** Route context: Next 16 passes dynamic params as a promise. */
interface RouteContext {
  params: Promise<{ token: string }>;
}

/**
 * RFC 8058 one-click unsubscribe. 200 once the opt-out is recorded (or
 * was already), 400 for an invalid token, 429 when this IP has sent too
 * many invalid tokens (a valid token is never rate-limited), and 500
 * when the write failed (already alerted), so the provider can retry.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;

  // Verify first, and never rate-limit a valid token. Gmail and Yahoo
  // send one-click POSTs from shared egress IPs, so a per-IP cap on every
  // POST would, in a busy minute, answer 429 to a genuine opt-out; the
  // provider may not retry, and nothing would alert. A valid token is
  // safe to honour however often it arrives: the write is idempotent and
  // keyed by the token's own address. Only invalid tokens (enumeration,
  // forgery) are counted and refused per IP.
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    const ip = ipOf(request);
    const attempt = await recordInvalidTokenAttempt({ ip, surface: 'unsubscribe' });
    const burst = await limiter.check(ip);
    if (!attempt.allowed || !burst.allowed) {
      const retryAfter = burst.allowed ? attempt.retryAfter : burst.retryAfter;
      return NextResponse.json(
        { error: 'rate limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: 'invalid token' }, { status: 400 });
  }

  const recorded = await recordUnsubscribe(payload, 'one_click');
  if (!recorded.ok) {
    return NextResponse.json({ error: 'could not record the unsubscribe' }, { status: 500 });
  }
  return NextResponse.json({ unsubscribed: true });
}

/**
 * A GET on the header URL (a prefetch, or a person opening it by hand).
 * Never writes: 303 to the confirmation page for the same token.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url), {
    status: 303,
  });
}
