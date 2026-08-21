/**
 * Public slots listing API route.
 *
 * Returns available booking slots for an MC's meeting type within a given
 * date range. Supports two modes:
 * - Share token: public scheduler widget (existing behaviour)
 * - Manage token: booking management page (reschedule mode with self-exclusion)
 *
 * Rate-limited per IP to cap the chattiness of slot browsing.
 *
 * Failure posture is FAIL CLOSED:
 * - Unavailable bookings or external calendar fetch → 503
 * - Invalid/inactive token → 404 (never leak token state)
 * - Invalid query → 400
 * - Rate limit → 429
 *
 * @module app/api/booking/slots/route
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseSearchParams } from '@/lib/api/validate';
import {
  BookingsUnavailableError,
  getBookableSlots,
  loadBookingContext,
  loadBookingContextByManageToken,
} from '@/lib/booking/availability';
import { FreeBusyUnavailableError } from '@/lib/calendar/free-busy';
import { createClient } from '@/lib/supabase/server';

import { slotsQuerySchema } from '../slots-schema';

// 30 / min / IP - slot browsing can be chatty as the couple explores dates.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 30 });

/**
 * GET /api/booking/slots?token=<uuid>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 * GET /api/booking/slots?manageToken=<uuid>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns available slots within the specified range, along with the MC's
 * timezone and meeting duration.
 *
 * With share token: returns all slots (public scheduler).
 * With manage token: returns slots with the booker's own booking excluded
 * from the busy set (reschedule mode).
 */
export async function GET(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = parseSearchParams(request, slotsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { token, manageToken, from, to } = parsed.data;

  const supabase = await createClient();

  let ctx;
  let excludeBookingId: string | undefined;
  const logToken = token ?? manageToken;

  if (token) {
    // Share token mode: public scheduler
    ctx = await loadBookingContext(supabase, token);
    if (!ctx) {
      await recordInvalidTokenAttempt({ ip, surface: 'slots' });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } else if (manageToken) {
    // Manage token mode: reschedule with self-exclusion
    const result = await loadBookingContextByManageToken(supabase, manageToken);
    if (!result) {
      await recordInvalidTokenAttempt({ ip, surface: 'slots' });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    ctx = result.ctx;
    excludeBookingId = result.bookingId;
  } else {
    // Schema should have caught this
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    // Parse date range
    const fromDate = new Date(from);
    const toDate = new Date(to);
    // The schema caps from..to at 31 calendar days INCLUSIVE. The engine
    // takes an exclusive end instant, so the full final day is included by
    // advancing one day: a maximal request therefore spans 32 clock days
    // by design, which is what "31 bookable days" means here.
    toDate.setDate(toDate.getDate() + 1);

    // Why: getBookableSlots calls getBusyIntervals (anonymous free/busy only, no titles).
    // NEVER switch to getBusyEvents here. A couple browsing this public API endpoint must
    // never learn anything about the MC's private calendar content (event titles, subjects).
    // The only visibility is time availability, not what occupies that time. Switching to
    // titled events would create a privacy leak where unauthorised users observe private
    // calendar details. See app/api/calendar/busy/route.ts for the full reasoning.
    const slots = await getBookableSlots(ctx, {
      start: fromDate,
      end: toDate,
    }, undefined, excludeBookingId);

    return NextResponse.json({
      slots,
      timezone: ctx.timezone,
      durationMinutes: ctx.meetingType.duration_minutes,
    });
  } catch (err) {
    // Both FreeBusyUnavailableError and BookingsUnavailableError
    // are fail-closed: we cannot verify availability.
    if (err instanceof FreeBusyUnavailableError || err instanceof BookingsUnavailableError) {
      logger.error('[booking/slots] availability unavailable', err, { logToken, ip });
      return NextResponse.json(
        { error: 'availability_unavailable' },
        { status: 503 },
      );
    }

    // Unexpected error
    logger.error('[booking/slots] unexpected error', err, { logToken, ip });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
