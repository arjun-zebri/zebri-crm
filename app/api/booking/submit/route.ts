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
import {
  formatAnswerValue,
  parseBookingQuestions,
  validateAnswers,
  type BookingAnswer,
} from '@/lib/booking/questions';
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
 *
 * Answers go over as `{ question_id, value }` only: the RPC copies each
 * label and type from the stored question, so nothing the booker sends can
 * relabel an answer.
 */
function toRpcParams(
  input: BookingSubmitInput,
  durationMinutes: number,
  answers: BookingAnswer[],
  phone: string | undefined,
) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  return {
    token: input.token,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_timezone: input.timezone,
    p_name: input.name,
    p_email: input.email,
    p_answers: answers.map((a) => ({ question_id: a.question_id, value: a.value })),
    ...(phone !== undefined && { p_phone: phone }),
    ...(input.notes !== undefined && { p_notes: input.notes }),
  };
}

/**
 * Check the booker's answers and phone against the meeting type's form.
 *
 * Returns the cleaned answers, or per-field errors keyed the way the public
 * form keys its inputs (`phone`, or a question id), so the form can put each
 * message beside the field it belongs to.
 */
function checkForm(
  input: BookingSubmitInput,
  meetingType: { questions: unknown; phone_field: string },
):
  | { ok: true; answers: BookingAnswer[]; phone: string | undefined }
  | { ok: false; fieldErrors: Record<string, string> } {
  const questions = parseBookingQuestions(meetingType.questions);
  const raw = Object.fromEntries(input.answers.map((a) => [a.question_id, a.value]));
  const { answers, errors } = validateAnswers(questions, raw);

  // A hidden phone field is dropped rather than rejected: a form that stopped
  // asking for it should not fail a submission from a page loaded earlier.
  const phone = meetingType.phone_field === 'hidden' ? undefined : input.phone;
  if (meetingType.phone_field === 'required' && !phone) {
    errors.phone = 'Add a phone number';
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, answers, phone };
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

  const form = checkForm(input, ctx.meetingType);
  if (!form.ok) {
    return NextResponse.json(
      { error: 'Please check the form and try again.', fieldErrors: form.fieldErrors },
      { status: 400 },
    );
  }
  const { answers, phone } = form;

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
    toRpcParams(input, ctx.meetingType.duration_minutes, answers, phone),
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

  // Answers as plain text, shared by the calendar event and the MC's email.
  const answerLines = answers.map((a) => ({ label: a.label, value: formatAnswerValue(a) }));

  let joinUrl: string | null = null;
  const eventIds: Record<string, string> = {};

  // Push the booking event to the MC's external calendar
  const locationType = ctx.meetingType.location_type as 'video' | 'phone' | 'in_person';
  try {
    const pushed = await pushBookingEvent(supabase, userId, {
      summary: `Consultation: ${input.name}`,
      description: [
        `Booking from ${input.name}`,
        `Email: ${input.email}`,
        phone && `Phone: ${phone}`,
        ...answerLines.map((a) => `${a.label}: ${a.value}`),
        input.notes && `Notes: ${input.notes}`,
      ].filter(Boolean).join('\n'),
      start: startsAt,
      end: endsAt,
      attendeeEmail: input.email,
      attendeeName: input.name,
      withConference: locationType === 'video',
    });

    if (pushed) {
      joinUrl = pushed.joinUrl;
      eventIds[pushed.provider] = pushed.eventId;
      // The event landed but the provider minted no conference link, so
      // the couple's confirmation says "link to follow" and the MC has to
      // send one by hand. Providers answer this with a normal 201 (Graph
      // on a calendar without Teams, Meet still pending), so it is
      // invisible unless we say it here.
      if (locationType === 'video' && !joinUrl) {
        await sendAlert({
          type: 'booking_video_link_missing',
          severity: 'warn',
          userId,
          provider: pushed.provider,
          bookingId,
          diagnostic: pushed.joinUrlDiagnostic ?? 'no diagnostic',
        });
      }
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
        phone,
        notes: input.notes,
        answers: answerLines,
      },
    }).catch((err) => {
      logger.error('[booking/submit] notification email failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Alert to Slack ops channel. No booker name (T27): the booker is
  // couple-side, not Zebri's own customer; `bookingId` is enough to look
  // the booking up from the app.
  await sendAlert({
    type: 'booking_created',
    severity: 'info',
    userId,
    email: mcUser?.user?.email || 'unknown',
    bookingId,
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
