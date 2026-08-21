/**
 * Public booking ingest endpoint.
 *
 * Unauthenticated: the share token IS the capability. Mirrors the lead capture
 * flow: rate-limited at the IP level, honeypot + timing checked, Zod-validated,
 * then handed to the `submit_booking` RPC. On success, the booking event is
 * pushed to the MC's external calendar (if available) and emails are dispatched.
 * Non-blocking failures alert without failing the booking.
 *
 * @module app/api/booking/submit/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import {
  bookingSubmitSchema,
  isLikelyBot,
  type BookingSubmitInput,
} from '@/app/api/booking/submit-schema';
import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import {
  loadBookingContext,
  isSlotBookable,
  BookingsUnavailableError,
} from '@/lib/booking/availability';
import { pushBookingEvent, EventPushError } from '@/lib/calendar/event-push';
import { FreeBusyUnavailableError } from '@/lib/calendar/free-busy';
import {
  sendBookingConfirmationEmail,
  sendBookingNotificationEmail,
} from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 5 / min / IP - a genuine visitor submits once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });

const ok = () => NextResponse.json({ ok: true });

/**
 * Map the validated input and meeting type to the RPC call parameters.
 * Computes endsAt from startsAt + meeting type duration.
 */
function toRpcParams(
  input: BookingSubmitInput,
  durationMinutes: number,
) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  const params: Record<string, unknown> = {
    token: input.token,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_timezone: input.timezone,
    p_name: input.name,
    p_email: input.email,
  };

  if (input.partnerName !== undefined) {
    params.p_partner_name = input.partnerName;
  }
  if (input.phone !== undefined) {
    params.p_phone = input.phone;
  }
  if (input.notes !== undefined) {
    params.p_notes = input.notes;
  }

  return params as unknown as {
    token: string;
    p_starts_at: string;
    p_ends_at: string;
    p_timezone: string;
    p_name: string;
    p_email: string;
    p_partner_name?: string;
    p_phone?: string;
    p_notes?: string;
  };
}

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, bookingSubmitSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Bots get a silent success so scrapers learn nothing.
  if (isLikelyBot(input, Date.now())) return ok();

  const supabase = await createClient();

  // Load the booking context (meeting type, availability rules, MC timezone)
  const ctx = await loadBookingContext(supabase, input.token);
  if (!ctx) {
    await recordInvalidTokenAttempt({ ip, surface: 'booking' });
    return NextResponse.json({ error: 'Booking not available.' }, { status: 404 });
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + ctx.meetingType.duration_minutes * 60 * 1000);

  // Re-verify the slot is still available before submitting to the RPC
  try {
    const bookable = await isSlotBookable(ctx, startsAt, endsAt);
    if (!bookable) {
      return NextResponse.json({ error: 'Slot is no longer available.' }, { status: 409 });
    }
  } catch (err) {
    // Fail closed: FreeBusyUnavailableError or BookingsUnavailableError means
    // we cannot verify the slot, so reject the booking rather than risk double-booking.
    if (err instanceof FreeBusyUnavailableError || err instanceof BookingsUnavailableError) {
      logger.error('[booking/submit] availability check failed', err, { ip });
      return new NextResponse('Availability temporarily unavailable', { status: 503 });
    }
    throw err;
  }

  // Submit the booking via RPC (SECURITY DEFINER handles the write)
  const { data, error } = await supabase.rpc(
    'submit_booking',
    toRpcParams(input, ctx.meetingType.duration_minutes),
  );

  if (error) {
    logger.error('[booking/submit] submit_booking RPC failed', error, { ip });
    return NextResponse.json({ error: 'Could not complete booking' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    booking_id?: string;
    manage_token?: string;
    user_id?: string;
    couple_id?: string | null;
    couple_created?: boolean;
    couple_linked?: boolean;
    business_name?: string;
  };

  // Handle RPC error responses
  if (result.error === 'not_found') {
    await recordInvalidTokenAttempt({ ip, surface: 'booking' });
    return NextResponse.json({ error: 'Booking not available.' }, { status: 404 });
  }

  if (result.error === 'slot_taken') {
    return NextResponse.json({ error: 'Slot is no longer available.' }, { status: 409 });
  }

  if (result.error === 'invalid') {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });
  }

  if (result.error === 'rate_limited') {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // manage_token is validated alongside the ids: the confirmation email
  // builds its reschedule link from it, and a silent fallback would ship a
  // dead /book/manage/ link to the booker.
  if (!result.ok || !result.booking_id || !result.user_id || !result.manage_token) {
    logger.error('[booking/submit] unexpected RPC response', result);
    return NextResponse.json({ error: 'Could not complete booking' }, { status: 500 });
  }

  // Success: booking created. Now attempt non-blocking operations:
  // 1. Push event to MC's external calendar (if connected)
  // 2. Send confirmation email to booker
  // 3. Send notification email to MC
  // 4. Alert to Slack

  const bookingId = result.booking_id;
  const userId = result.user_id;
  const manageToken = result.manage_token;
  const businessName = result.business_name || 'your business';

  const admin = createAdminClient();
  let joinUrl: string | null = null;
  const eventIds: Record<string, string> = {};

  // Push the booking event to the MC's external calendar
  const locationType = ctx.meetingType.location_type as 'video' | 'phone' | 'in_person';
  try {
    const pushed = await pushBookingEvent(supabase, userId, {
      summary: `Consultation: ${input.name}`,
      description: `Booking from ${input.name}\nEmail: ${input.email}\n${input.phone ? `Phone: ${input.phone}` : ''}${input.notes ? `\nNotes: ${input.notes}` : ''}`,
      start: startsAt,
      end: endsAt,
      attendeeEmail: input.email,
      attendeeName: input.name,
      withConference: locationType === 'video',
    });

    if (pushed) {
      joinUrl = pushed.joinUrl;
      eventIds[pushed.provider] = pushed.eventId;
    } else {
      // A null push means the MC has no connected calendar at all, which is
      // silent everywhere else: slots were offered without checking their real
      // calendar, the booking will never appear on it, and a video meeting
      // goes out with no join link. Tell them before a double-booking does.
      await sendAlert({
        type: 'booking_created_without_calendar',
        severity: 'warn',
        userId,
        bookingId,
        locationType,
      });
    }
  } catch (err) {
    if (err instanceof EventPushError) {
      // Log the failure and alert, but don't fail the booking
      logger.warn('[booking/submit] event push failed', {
        provider: err.provider,
        status: err.status,
        message: err.message,
      });
      await sendAlert({
        type: 'booking_event_push_failed',
        severity: 'warn',
        userId,
        provider: err.provider,
        status: err.status,
        bookingId,
      });
    } else {
      logger.error('[booking/submit] event push unexpected error', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update the booking row with calendar event details (non-blocking)
  if (joinUrl || Object.keys(eventIds).length > 0) {
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        video_join_url: joinUrl,
        external_event_ids: Object.keys(eventIds).length > 0 ? eventIds : null,
      })
      .eq('id', bookingId);

    if (updateErr) {
      logger.error('[booking/submit] failed to update booking with event details', updateErr);
    }
  }

  // Send confirmation email to the booker
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const manageUrl = `${APP_URL}/book/manage/${manageToken}`;

  void sendBookingConfirmationEmail(supabase, {
    userId,
    businessName,
    to: input.email,
    bookerName: input.name,
    meetingTypeName: ctx.meetingType.name,
    start: startsAt,
    end: endsAt,
    timezone: input.timezone,
    locationType,
    address: ctx.meetingType.address,
    joinUrl,
    manageUrl,
  }).catch((err) => {
    logger.error('[booking/submit] confirmation email failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  });

  // Fetch the MC's email for the notification (using admin client for security)
  const { data: mcUser, error: mcUserErr } = await admin.auth.admin.getUserById(userId);

  if (mcUserErr || !mcUser?.user?.email) {
    logger.error('[booking/submit] failed to fetch MC email', mcUserErr || 'user not found');
  } else {
    // Send notification email to the MC
    void sendBookingNotificationEmail({
      to: mcUser.user.email,
      mcBusinessName: businessName,
      booking: {
        bookerName: input.name,
        bookerEmail: input.email,
        meetingTypeName: ctx.meetingType.name,
        start: startsAt,
        end: endsAt,
        // The MC's own zone, not the booker's. These are two different people
        // in two possibly different places reading the same instant: the
        // couple's confirmation above renders in theirs, this renders in the
        // MC's, so neither has to convert.
        timezone: ctx.timezone,
        locationType,
        address: ctx.meetingType.address,
        joinUrl,
      },
    }).catch((err) => {
      logger.error('[booking/submit] notification email failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Alert to Slack ops channel
  await sendAlert({
    type: 'booking_created',
    severity: 'info',
    userId,
    email: mcUser?.user?.email || 'unknown',
    bookerName: input.name,
    manageToken,
  });

  // Return success with timing and join details to the booker
  return NextResponse.json({
    ok: true,
    joinUrl,
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
    timezone: input.timezone,
  });
}
