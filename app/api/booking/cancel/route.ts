/**
 * Public booking cancellation endpoint.
 *
 * Unauthenticated: the manage token IS the capability. Rate-limited at the
 * IP level, Zod-validated, then handed to the `cancel_booking` RPC.
 * On success, the booking event is deleted from the MC's external calendar
 * (non-blocking: failure alerts but does not fail the request since the
 * booking is already cancelled in the database). Cancellation and change
 * notification emails are dispatched.
 *
 * @module app/api/booking/cancel/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { bookingCancelSchema } from '@/app/api/booking/cancel-schema';
import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { completeCancellation } from '@/lib/booking/lifecycle';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 5 / min / IP - a genuine visitor cancels once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });

/**
 * POST handler for booking cancellation.
 * Rate limits by IP, validates input, calls cancel_booking RPC,
 * deletes the event from the MC's calendar (non-blocking),
 * sends cancellation and notification emails, and returns 200 OK.
 */
export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, bookingCancelSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const supabase = await createClient();

  // Call the cancel_booking RPC
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_manage_token: input.manageToken,
  });

  if (error) {
    logger.error('[booking/cancel] cancel_booking RPC failed', error, { ip });
    return NextResponse.json({ error: 'Could not cancel booking' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    booking_id?: string;
    user_id?: string;
    starts_at?: string;
    ends_at?: string;
    timezone?: string;
    name?: string;
    email?: string;
    business_name?: string;
    external_event_ids?: Record<string, string>;
    meeting_type_name?: string;
  };

  // Handle RPC error responses
  if (result.error === 'not_found') {
    await recordInvalidTokenAttempt({ ip, surface: 'manage' });
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  if (result.error === 'already_cancelled') {
    return NextResponse.json({ error: 'Booking is already cancelled.' }, { status: 409 });
  }

  if (result.error === 'past') {
    return NextResponse.json({ error: 'Cannot cancel a past booking.' }, { status: 409 });
  }

  if (!result.ok || !result.booking_id || !result.user_id) {
    logger.error('[booking/cancel] unexpected RPC response', result);
    return NextResponse.json({ error: 'Could not cancel booking' }, { status: 500 });
  }

  // Success: booking cancelled. Now attempt non-blocking post-RPC operations:
  // calendar event deletion, booker cancellation email, MC notification email.
  // These never throw; the booking is already cancelled in the database.
  const admin = createAdminClient();
  void completeCancellation(admin, result);

  return NextResponse.json({ ok: true });
}
