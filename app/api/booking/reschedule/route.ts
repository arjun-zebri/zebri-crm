/**
 * Public booking rescheduling endpoint.
 *
 * Unauthenticated: the manage token IS the capability. Rate-limited at the
 * IP level, Zod-validated, then re-verifies slot availability before calling
 * the `reschedule_booking` RPC. On success, the booking event is updated on
 * the MC's external calendar (non-blocking: failure alerts but does not fail
 * the request). Reschedule and change notification emails are dispatched.
 *
 * @module app/api/booking/reschedule/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { bookingRescheduleSchema } from '@/app/api/booking/reschedule-schema';
import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import {
  loadBookingContextByManageToken,
  isSlotBookable,
  BookingsUnavailableError,
} from '@/lib/booking/availability';
import { completeReschedule } from '@/lib/booking/lifecycle';
import { FreeBusyUnavailableError } from '@/lib/calendar/free-busy';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 5 / min / IP - a genuine visitor reschedules once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });

/**
 * POST handler for booking rescheduling.
 * Rate limits by IP, validates input, loads booking context,
 * re-verifies slot availability, calls reschedule_booking RPC,
 * updates the event on the MC's calendar (non-blocking),
 * sends reschedule and notification emails, and returns 200 with timing details.
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

  const parsed = await parseJsonBody(request, bookingRescheduleSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const supabase = await createClient();

  // Load the booking context by manage token
  const ctxData = await loadBookingContextByManageToken(supabase, input.manageToken);
  if (!ctxData) {
    await recordInvalidTokenAttempt({ ip, surface: 'manage' });
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const { ctx, bookingId } = ctxData;

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + ctx.meetingType.duration_minutes * 60 * 1000);

  // Re-verify the slot is still available before submitting to the RPC
  // Why: catch collisions early to return 409 instead of letting the RPC fail.
  // excludeBookingId allows the booker to reschedule to their current time
  // or adjacent times without being blocked by their own event.
  try {
    const bookable = await isSlotBookable(ctx, startsAt, endsAt, undefined, bookingId);
    if (!bookable) {
      return NextResponse.json({ error: 'Slot is no longer available.' }, { status: 409 });
    }
  } catch (err) {
    // Fail closed: FreeBusyUnavailableError or BookingsUnavailableError means
    // we cannot verify the slot, so reject the reschedule rather than risk double-booking.
    if (err instanceof FreeBusyUnavailableError || err instanceof BookingsUnavailableError) {
      logger.error('[booking/reschedule] availability check failed', err, { ip });
      return new NextResponse('Availability temporarily unavailable', { status: 503 });
    }
    throw err;
  }

  // Reschedule the booking via RPC (SECURITY DEFINER handles the write)
  const { data, error } = await supabase.rpc('reschedule_booking', {
    p_manage_token: input.manageToken,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
  });

  if (error) {
    logger.error('[booking/reschedule] reschedule_booking RPC failed', error, { ip });
    return NextResponse.json({ error: 'Could not reschedule booking' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    booking_id?: string;
    user_id?: string;
    previous_starts_at?: string;
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

  if (result.error === 'cancelled' || result.error === 'past') {
    return NextResponse.json({ error: 'Cannot reschedule a cancelled or past booking.' }, { status: 409 });
  }

  if (result.error === 'slot_taken') {
    return NextResponse.json({ error: 'Slot is no longer available.' }, { status: 409 });
  }

  if (result.error === 'invalid') {
    return NextResponse.json({ error: 'Invalid time range.' }, { status: 400 });
  }

  if (!result.ok || !result.booking_id || !result.user_id) {
    logger.error('[booking/reschedule] unexpected RPC response', result);
    return NextResponse.json({ error: 'Could not reschedule booking' }, { status: 500 });
  }

  // Success: booking rescheduled. Now attempt non-blocking post-RPC operations:
  // calendar event update, reschedule email, MC notification email.
  // These never throw; the booking is already rescheduled in the database.
  const admin = createAdminClient();
  void completeReschedule(admin, result, input.manageToken);

  const newStartsAt = new Date(result.starts_at!);
  const newEndsAt = new Date(result.ends_at!);
  const timezone = result.timezone!;

  return NextResponse.json({
    ok: true,
    start: newStartsAt.toISOString(),
    end: newEndsAt.toISOString(),
    timezone,
  });
}
