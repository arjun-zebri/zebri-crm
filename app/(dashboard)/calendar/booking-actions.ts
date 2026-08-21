/**
 * Server actions for authenticated booking management.
 *
 * MC dashboard actions to cancel and reschedule their own bookings.
 * Both actions use the RLS-scoped Supabase client to read the booking,
 * proving ownership through row-level security. Once ownership is
 * established, the manage_token is extracted and the same RPC the public
 * route calls is invoked, then orchestration is delegated to Task 4's
 * lifecycle helpers.
 *
 * Why the public RPCs and not owner-scoped duplicates: every guard
 * (already_cancelled, past, etc.), the exclusion-constraint catch
 * (slot_taken), the booking_cancelled automation event, and the
 * reminder_sent_at clearing exist exactly once, reducing the surface
 * for drift and drift-induced bugs. The capability token (manage_token)
 * never leaves the server boundary.
 *
 * @module app/(dashboard)/calendar/booking-actions
 */
'use server';

import { logger } from '@/lib/alerts/logger';
import {
  loadBookingContextByManageToken,
  isSlotBookable,
  BookingsUnavailableError,
} from '@/lib/booking/availability';
import { completeCancellation, completeReschedule } from '@/lib/booking/lifecycle';
import { FreeBusyUnavailableError } from '@/lib/calendar/free-busy';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { bookingRescheduleActionSchema } from './booking-actions-schema';

/* ─── Tagged result type ───────────────────────────────────────── */

/**
 * Successful action result.
 */
export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

/**
 * Failed action result carrying an error message.
 */
export interface ActionFailure {
  ok: false;
  error: string;
}

/**
 * Tagged union of success or failure. Pattern-match with `if (result.ok)`.
 */
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Authenticated user helper ──────────────────────────────────── */

/**
 * Resolve the signed-in user + RLS-scoped client, or a tagged error.
 */
async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Session expired. Please log in again.' };
  return { ok: true as const, supabase, userId: user.id };
}

/* ─── cancelBookingAction ────────────────────────────────────────── */

/**
 * Cancel a booking owned by the authenticated user.
 *
 * Reads the booking through the RLS-scoped client (ownership verification).
 * Extracts the manage_token and calls the same cancel_booking RPC the public
 * route uses. Then delegates to Task 4's lifecycle helpers for calendar and
 * email operations.
 *
 * @param bookingId - UUID of the booking to cancel
 * @returns success with empty data, or error
 */
export async function cancelBookingAction(bookingId: string): Promise<ActionResult<object>> {
  const auth = await authedUser();
  if (!auth.ok) return auth;

  // Read booking through RLS client: proves ownership.
  // Another MC's booking simply will not be found, and we return the same
  // not-found error for both "does not exist" and "not yours" so the action
  // cannot be used to probe whether a booking id exists.
  const { data: booking, error: bookingError } = await auth.supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    logger.error('[calendar/booking-actions] cancelBookingAction booking not found', {
      userId: auth.userId,
      bookingId,
      error: bookingError?.message,
    });
    return { ok: false, error: 'Booking not found.' };
  }

  // Extract the manage token for the RPC
  const manageToken = booking.manage_token;

  // Call the same RPC the public route uses
  const { data, error } = await auth.supabase.rpc('cancel_booking', {
    p_manage_token: manageToken,
  });

  if (error) {
    logger.error('[calendar/booking-actions] cancel_booking RPC failed', {
      userId: auth.userId,
      bookingId,
      error: error.message,
    });
    return { ok: false, error: 'Could not cancel booking' };
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
    return { ok: false, error: 'Booking not found.' };
  }

  if (result.error === 'already_cancelled') {
    return { ok: false, error: 'Booking is already cancelled.' };
  }

  if (result.error === 'past') {
    return { ok: false, error: 'Cannot cancel a past booking.' };
  }

  if (!result.ok || !result.booking_id || !result.user_id) {
    logger.error('[calendar/booking-actions] unexpected RPC response', {
      userId: auth.userId,
      result,
    });
    return { ok: false, error: 'Could not cancel booking' };
  }

  // Success: booking cancelled. Now attempt non-blocking post-RPC operations:
  // calendar event deletion, booker cancellation email, MC notification email.
  // These never throw; the booking is already cancelled in the database.
  const admin = createAdminClient();
  void completeCancellation(admin, result);

  return { ok: true, data: {} };
}

/* ─── rescheduleBookingAction ────────────────────────────────────── */

/**
 * Reschedule a booking owned by the authenticated user.
 *
 * Reads the booking through the RLS-scoped client (ownership verification).
 * Re-verifies the new slot is still available before calling the reschedule_booking
 * RPC. Maps availability errors to tagged failures (fail closed). Then delegates
 * to Task 4's lifecycle helpers for calendar and email operations.
 *
 * @param bookingId - UUID of the booking to reschedule
 * @param startsAt - new start time in ISO 8601 format
 * @param timezone - booker's timezone (validated against IANA list)
 * @returns success with new times, or error
 */
export async function rescheduleBookingAction(
  bookingId: string,
  startsAt: string,
  timezone: string,
): Promise<ActionResult<{ start: string; end: string; timezone: string }>> {
  const auth = await authedUser();
  if (!auth.ok) return auth;

  // Validate input
  const parsed = bookingRescheduleActionSchema.safeParse({ startsAt, timezone });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid time or timezone.' };
  }

  // Read booking through RLS client: proves ownership
  const { data: booking, error: bookingError } = await auth.supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    logger.error('[calendar/booking-actions] rescheduleBookingAction booking not found', {
      userId: auth.userId,
      bookingId,
      error: bookingError?.message,
    });
    return { ok: false, error: 'Booking not found.' };
  }

  // Extract the manage token for the RPC
  const manageToken = booking.manage_token;

  // Load the booking context (meeting type, rules, overrides, timezone)
  const ctxData = await loadBookingContextByManageToken(auth.supabase, manageToken);
  if (!ctxData) {
    logger.error('[calendar/booking-actions] could not load booking context', {
      userId: auth.userId,
      bookingId,
      manageToken,
    });
    return { ok: false, error: 'Booking configuration unavailable.' };
  }

  const { ctx } = ctxData;

  // Compute the new end time based on meeting type duration
  const newStartsAt = new Date(parsed.data.startsAt);
  const newEndsAt = new Date(newStartsAt.getTime() + ctx.meetingType.duration_minutes * 60 * 1000);

  // Re-verify the slot is still available before calling the RPC
  // Why: catch collisions early to return a user-friendly error instead of
  // letting the RPC fail with slot_taken. excludeBookingId allows the MC to
  // reschedule to their current time or adjacent times without being blocked
  // by their own event.
  try {
    const bookable = await isSlotBookable(
      ctx,
      newStartsAt,
      newEndsAt,
      undefined,
      bookingId,
    );
    if (!bookable) {
      return { ok: false, error: 'Time slot is no longer available.' };
    }
  } catch (err) {
    // Fail closed: FreeBusyUnavailableError or BookingsUnavailableError means
    // we cannot verify the slot, so reject the reschedule rather than risk
    // double-booking.
    if (err instanceof FreeBusyUnavailableError || err instanceof BookingsUnavailableError) {
      logger.error('[calendar/booking-actions] availability check failed', {
        userId: auth.userId,
        bookingId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, error: 'Availability temporarily unavailable. Please try again.' };
    }
    throw err;
  }

  // Reschedule the booking via RPC (SECURITY DEFINER handles the write)
  const { data, error } = await auth.supabase.rpc('reschedule_booking', {
    p_manage_token: manageToken,
    p_starts_at: newStartsAt.toISOString(),
    p_ends_at: newEndsAt.toISOString(),
  });

  if (error) {
    logger.error('[calendar/booking-actions] reschedule_booking RPC failed', {
      userId: auth.userId,
      bookingId,
      error: error.message,
    });
    return { ok: false, error: 'Could not reschedule booking' };
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
    return { ok: false, error: 'Booking not found.' };
  }

  if (result.error === 'cancelled' || result.error === 'past') {
    return { ok: false, error: 'Cannot reschedule a cancelled or past booking.' };
  }

  if (result.error === 'slot_taken') {
    return { ok: false, error: 'Time slot is no longer available.' };
  }

  if (result.error === 'invalid') {
    return { ok: false, error: 'Invalid time range.' };
  }

  if (!result.ok || !result.booking_id || !result.user_id) {
    logger.error('[calendar/booking-actions] unexpected RPC response', {
      userId: auth.userId,
      result,
    });
    return { ok: false, error: 'Could not reschedule booking' };
  }

  // Success: booking rescheduled. Now attempt non-blocking post-RPC operations:
  // calendar event update, reschedule email, MC notification email.
  // These never throw; the booking is already rescheduled in the database.
  const admin = createAdminClient();
  void completeReschedule(admin, result, manageToken);

  const finalStartsAt = new Date(result.starts_at!);
  const finalEndsAt = new Date(result.ends_at!);
  const finalTimezone = result.timezone!;

  return {
    ok: true,
    data: {
      start: finalStartsAt.toISOString(),
      end: finalEndsAt.toISOString(),
      timezone: finalTimezone,
    },
  };
}
