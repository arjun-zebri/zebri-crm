/**
 * Booking lifecycle orchestration (Phase E: Task 4).
 *
 * Post-RPC operations shared by cancel and reschedule surfaces (public routes
 * and authenticated dashboard). Extracts calendar syncing, email dispatch,
 * and MC notification so both paths stay in sync.
 *
 * Contract: these functions **never throw**. By the time they run, the RPC
 * has committed the database mutation (booking cancelled or rescheduled).
 * A calendar or email failure must not propagate, because the caller would
 * report failure to a user whose booking really was changed. Each step is
 * wrapped with catch/log/alert; if an email fails, the other emails still
 * try to send.
 *
 * @module lib/booking/lifecycle
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { deleteBookingEvent, EventPushError, updateBookingEvent } from '@/lib/calendar/event-push';
import {
  sendBookingCancelledEmail,
  sendBookingChangeNotificationEmail,
  sendBookingRescheduledEmail,
} from '@/lib/email/booking';
import type { Database } from '@/types/database';

/**
 * The MC's own display zone, for emails addressed to the MC.
 *
 * The booking row stores the BOOKER's zone, which is what their confirmation
 * and reminder render in. An MC in Sydney taking a booking from Perth must not
 * be told their own diary in Perth time, so MC-facing mail resolves this
 * instead. Falls back to the booker's zone (rather than guessing) when the
 * setting is missing, matching the slot engine's own default behaviour.
 */
async function mcDisplayTimezone(
  admin: SupabaseClient<Database>,
  userId: string,
  fallback: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from('user_public_settings')
      .select('timezone')
      .eq('user_id', userId)
      .limit(1);
    return data?.[0]?.timezone ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Result shape from the `cancel_booking` RPC. Extracted for use by both
 * the public route and authenticated dashboard.
 */
export interface CancelRpcResult {
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
}

/**
 * Result shape from the `reschedule_booking` RPC. Extracted for use by both
 * the public route and authenticated dashboard.
 */
export interface RescheduleRpcResult {
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
}

/**
 * Complete a booking cancellation: delete the calendar event, send cancellation
 * and MC notification emails.
 *
 * Never throws. Catches and logs each step independently. An `EventPushError`
 * still allows emails to send; a failing email does not prevent the other
 * from trying. Always succeeds from the caller's perspective because the
 * database mutation has already committed.
 */
export async function completeCancellation(
  admin: SupabaseClient<Database>,
  result: CancelRpcResult,
): Promise<void> {
  const bookingId = result.booking_id!;
  const userId = result.user_id!;
  const startsAt = new Date(result.starts_at!);
  const endsAt = new Date(result.ends_at!);
  const timezone = result.timezone!;
  const bookerName = result.name!;
  const bookerEmail = result.email!;
  const businessName = result.business_name || 'your business';
  const meetingTypeName = result.meeting_type_name!;
  const externalEventIds = result.external_event_ids || {};

  // Delete the booking event from the MC's external calendar.
  // Non-blocking: failure alerts but does not prevent email dispatch.
  try {
    await deleteBookingEvent(admin, userId, externalEventIds);
  } catch (err) {
    if (err instanceof EventPushError) {
      logger.warn('[booking/lifecycle] event delete failed', {
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
      logger.error('[booking/lifecycle] event delete unexpected error', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fetch meeting type location info for emails.
  let locationType: 'video' | 'phone' | 'in_person' = 'in_person';
  let address: string | null = null;

  try {
    const { data: meetingType } = await admin
      .from('meeting_types')
      .select('location_type, address')
      .eq('name', meetingTypeName)
      .single();

    locationType = (meetingType?.location_type as 'video' | 'phone' | 'in_person') || 'in_person';
    address = meetingType?.address || null;
  } catch (err) {
    logger.error('[booking/lifecycle] meeting type fetch failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Send cancellation email to the booker. Non-blocking.
  try {
    await sendBookingCancelledEmail(admin, {
      userId,
      businessName,
      to: bookerEmail,
      bookerName,
      meetingTypeName,
      start: startsAt,
      end: endsAt,
      timezone,
      locationType,
      address,
      joinUrl: null,
    });
  } catch (err) {
    logger.error('[booking/lifecycle] cancellation email failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Fetch the MC's email for the notification. Non-blocking.
  let mcEmail: string | null = null;
  try {
    const { data: mcUser, error: mcUserErr } = await admin.auth.admin.getUserById(userId);

    if (mcUserErr) {
      logger.error('[booking/lifecycle] failed to fetch MC email', mcUserErr);
    } else if (mcUser?.user?.email) {
      mcEmail = mcUser.user.email;
    } else {
      logger.error('[booking/lifecycle] MC user not found or missing email');
    }
  } catch (err) {
    logger.error('[booking/lifecycle] MC auth fetch unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Send notification email to the MC. Non-blocking.
  if (mcEmail) {
    const mcTimezone = await mcDisplayTimezone(admin, userId, timezone);
    try {
      await sendBookingChangeNotificationEmail({
        to: mcEmail,
        mcBusinessName: businessName,
        kind: 'cancelled',
        booking: {
          bookerName,
          bookerEmail,
          meetingTypeName,
          start: startsAt,
          end: endsAt,
          timezone: mcTimezone,
          locationType,
          address,
          joinUrl: null,
        },
      });
    } catch (err) {
      logger.error('[booking/lifecycle] notification email failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Complete a booking reschedule: update the calendar event, send reschedule
 * and MC notification emails.
 *
 * Never throws. Catches and logs each step independently. An `EventPushError`
 * still allows emails to send; a failing email does not prevent the other
 * from trying. Always succeeds from the caller's perspective because the
 * database mutation has already committed.
 */
export async function completeReschedule(
  admin: SupabaseClient<Database>,
  result: RescheduleRpcResult,
  manageToken: string,
): Promise<void> {
  const bookingId = result.booking_id!;
  const userId = result.user_id!;
  const previousStartsAt = new Date(result.previous_starts_at!);
  const newStartsAt = new Date(result.starts_at!);
  const newEndsAt = new Date(result.ends_at!);
  const timezone = result.timezone!;
  const bookerName = result.name!;
  const bookerEmail = result.email!;
  const businessName = result.business_name || 'your business';
  const meetingTypeName = result.meeting_type_name!;
  const externalEventIds = result.external_event_ids || {};

  // Update the booking event on the MC's external calendar.
  // Non-blocking: failure alerts but does not prevent email dispatch.
  try {
    await updateBookingEvent(admin, userId, externalEventIds, {
      summary: `Consultation: ${bookerName}`,
      description: `Booking from ${bookerName}\nEmail: ${bookerEmail}`,
      start: newStartsAt,
      end: newEndsAt,
    });
  } catch (err) {
    if (err instanceof EventPushError) {
      logger.warn('[booking/lifecycle] event update failed', {
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
      logger.error('[booking/lifecycle] event update unexpected error', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fetch meeting type location info for emails.
  let locationType: 'video' | 'phone' | 'in_person' = 'in_person';
  let address: string | null = null;

  try {
    const { data: meetingType } = await admin
      .from('meeting_types')
      .select('location_type, address')
      .eq('name', meetingTypeName)
      .single();

    locationType = (meetingType?.location_type as 'video' | 'phone' | 'in_person') || 'in_person';
    address = meetingType?.address || null;
  } catch (err) {
    logger.error('[booking/lifecycle] meeting type fetch failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Send reschedule email to the booker. Non-blocking.
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const manageUrlValue = `${APP_URL}/book/manage/${manageToken}`;

  try {
    await sendBookingRescheduledEmail(admin, {
      userId,
      businessName,
      to: bookerEmail,
      bookerName,
      meetingTypeName,
      previousStart: previousStartsAt,
      start: newStartsAt,
      end: newEndsAt,
      timezone,
      locationType,
      address,
      joinUrl: null,
      manageUrl: manageUrlValue,
    });
  } catch (err) {
    logger.error('[booking/lifecycle] reschedule email failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Fetch the MC's email for the notification. Non-blocking.
  let mcEmail: string | null = null;
  try {
    const { data: mcUser, error: mcUserErr } = await admin.auth.admin.getUserById(userId);

    if (mcUserErr) {
      logger.error('[booking/lifecycle] failed to fetch MC email', mcUserErr);
    } else if (mcUser?.user?.email) {
      mcEmail = mcUser.user.email;
    } else {
      logger.error('[booking/lifecycle] MC user not found or missing email');
    }
  } catch (err) {
    logger.error('[booking/lifecycle] MC auth fetch unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Send notification email to the MC. Non-blocking.
  if (mcEmail) {
    const mcTimezone = await mcDisplayTimezone(admin, userId, timezone);
    try {
      await sendBookingChangeNotificationEmail({
        to: mcEmail,
        mcBusinessName: businessName,
        kind: 'rescheduled',
        booking: {
          bookerName,
          bookerEmail,
          meetingTypeName,
          start: newStartsAt,
          end: newEndsAt,
          timezone: mcTimezone,
          locationType,
          address,
          joinUrl: null,
        },
      });
    } catch (err) {
      logger.error('[booking/lifecycle] notification email failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
