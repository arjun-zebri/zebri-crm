/**
 * Bookable-slots service for the public scheduler.
 *
 * Loads an MC's availability config (rules + overrides), merges external
 * calendar busy intervals with confirmed bookings, and computes available
 * time slots.
 *
 * @module lib/booking/availability
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getBusyIntervals } from '@/lib/calendar/free-busy';
import type { BusyInterval } from '@/lib/calendar/intervals';
import { subtractInterval } from '@/lib/calendar/intervals';
import { computeSlots, type DateOverride, type Slot, type WeeklyRule } from '@/lib/scheduling/slots';
import { zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

/** Bookings query failed; slot listing must fail closed. */
export class BookingsUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('bookings unavailable');
    this.name = 'BookingsUnavailableError';
    this.cause = cause;
  }
}

/** Configuration and MC context for a single bookable meeting type. */
export interface BookingContext {
  meetingType: Database['public']['Tables']['meeting_types']['Row'];
  userId: string;
  timezone: string;
  rules: WeeklyRule[];
  overrides: DateOverride[];
}

/**
 * Internal helper to load weekly rules, date overrides, and timezone for
 * one meeting type and build the context.
 *
 * The weekly rules come from the meeting type when it carries its own
 * hours, and from the MC's user-level schedule otherwise.
 */
async function buildBookingContextFromMeetingType(
  meetingType: Database['public']['Tables']['meeting_types']['Row'],
): Promise<BookingContext | null> {
  const admin = createAdminClient();

  // Weekly hours come from ONE of two places. A meeting type on custom
  // hours replaces the MC's standard week outright rather than narrowing
  // it, so the two sets are never merged: an evening-consult type is
  // bookable in its own evenings and nowhere else.
  const { data: rules, error: rulesError } = meetingType.uses_custom_availability
    ? await admin
        .from('meeting_type_availability_rules')
        .select('weekday, start_time, end_time')
        .eq('meeting_type_id', meetingType.id)
    : await admin
        .from('availability_rules')
        .select('weekday, start_time, end_time')
        .eq('user_id', meetingType.user_id);

  // Date overrides stay user-level whichever weekly source won above: a
  // blocked wedding day blocks every meeting type.
  const { data: overrides, error: overridesError } = await admin
    .from('availability_overrides')
    .select('*')
    .eq('user_id', meetingType.user_id);

  // Load user timezone
  const { data: settings, error: settingsError } = await admin
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', meetingType.user_id);

  if (rulesError || overridesError || settingsError) {
    return null;
  }

  // Why: Default to Sydney when user_public_settings.timezone is null.
  const timezone = settings?.[0]?.timezone ?? 'Australia/Sydney';

  // Normalise DB times from HH:MM:SS to HH:mm for the engine
  const normalisedRules: WeeklyRule[] = (rules ?? []).map((r) => ({
    weekday: r.weekday,
    start_time: r.start_time.slice(0, 5),
    end_time: r.end_time.slice(0, 5),
  }));

  const normalisedOverrides: DateOverride[] = (overrides ?? []).map((o) => ({
    date: o.date,
    available: o.available,
    start_time: o.start_time ? o.start_time.slice(0, 5) : null,
    end_time: o.end_time ? o.end_time.slice(0, 5) : null,
  }));

  return {
    meetingType,
    userId: meetingType.user_id,
    timezone,
    rules: normalisedRules,
    overrides: normalisedOverrides,
  };
}

/**
 * Load the booking context for a public share token: meeting type, rules,
 * overrides, and timezone.
 *
 * Returns null if the token is unknown or the meeting type is inactive.
 * Timezone defaults to 'Australia/Sydney' if the MC never saved one.
 */
export async function loadBookingContext(
  supabase: SupabaseClient<Database>,
  shareToken: string,
): Promise<BookingContext | null> {
  const admin = createAdminClient();

  // Find the meeting type by share token
  const { data: meetingType, error: mtError } = await admin
    .from('meeting_types')
    .select('*')
    .eq('share_token', shareToken)
    .single();

  if (mtError || !meetingType || !meetingType.active) {
    return null;
  }

  return buildBookingContextFromMeetingType(meetingType);
}

/**
 * Load the booking context for a manage token: resolves the booking,
 * then loads the same context (meeting type, rules, overrides, timezone).
 *
 * Returns the booking context plus booking metadata (id, times, status),
 * or null if the token is unknown or the meeting type is inactive.
 *
 * @param supabase - client to query bookings table
 * @param manageToken - the booking's manage_token UUID
 */
export async function loadBookingContextByManageToken(
  supabase: SupabaseClient<Database>,
  manageToken: string,
): Promise<{ ctx: BookingContext; bookingId: string; startsAt: string; endsAt: string; status: string } | null> {
  const admin = createAdminClient();

  // Find the booking by manage token
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('*')
    .eq('manage_token', manageToken)
    .single();

  if (bookingError || !booking) {
    return null;
  }

  // Load the meeting type
  const { data: meetingType, error: mtError } = await admin
    .from('meeting_types')
    .select('*')
    .eq('id', booking.meeting_type_id)
    .single();

  if (mtError || !meetingType || !meetingType.active) {
    return null;
  }

  // Build the context using the shared helper
  const ctx = await buildBookingContextFromMeetingType(meetingType);
  if (!ctx) {
    return null;
  }

  return {
    ctx,
    bookingId: booking.id,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    status: booking.status,
  };
}

/**
 * Compute available slots for a date range, merging external calendar busy
 * intervals and confirmed bookings.
 *
 * Propagates FreeBusyUnavailableError (fail closed).
 *
 * @param ctx - the meeting type context
 * @param range - start and end dates for the range
 * @param now - current time (defaults to now)
 * @param excludeBookingId - optional booking id to exclude from busy set.
 *   Why: when rescheduling, the booker's own current booking should not
 *   block them from selecting their existing slot or times near it.
 */
export async function getBookableSlots(
  ctx: BookingContext,
  range: { start: Date; end: Date },
  now?: Date,
  excludeBookingId?: string,
): Promise<Slot[]> {
  const nowTime = now ?? new Date();

  // Service role, deliberately. `bookings` and `calendar_connections` are both
  // owner-only under RLS, and every real booker is anonymous: with a caller's
  // own client those reads returned ZERO rows and neither errors, so already
  // booked times and the MC's connected-calendar busy blocks silently vanished
  // and were offered as free. It looked correct only to the MC, whose own
  // session could see their rows. The share token is the capability that
  // authorises this, and every read below is scoped to `ctx`.
  const admin = createAdminClient();

  // Why: Call getBusyIntervals (anonymous free/busy only, no titles), never getBusyEvents.
  // This function is used by the public booking surfaces (app/api/booking/slots/route.ts).
  // A couple browsing those endpoints must never learn anything about the MC's private
  // calendar content (event titles, subjects). The only visibility is time availability.
  // Switching to titled events would create a privacy leak. See app/api/calendar/busy/route.ts
  // for the full reasoning behind this constraint.
  let externalBusy = await getBusyIntervals(admin, ctx.userId, range);

  // Fetch confirmed bookings in range as busy intervals
  const { data: bookings, error: bookingsError } = await admin
    .from('bookings')
    .select('*')
    .eq('meeting_type_id', ctx.meetingType.id)
    .eq('status', 'confirmed')
    .gte('starts_at', range.start.toISOString())
    .lt('ends_at', range.end.toISOString());

  if (bookingsError) {
    throw new BookingsUnavailableError(bookingsError);
  }

  // Why: If rescheduling, the excluded booking was already pushed to the
  // MC's calendar, so getBusyIntervals includes it. Remove its window from
  // external busy so the booker can move to their own booking's time or times
  // with buffer adjacency (e.g., 2pm to 2:30pm move not blocked by buffers).
  if (excludeBookingId && bookings) {
    const excludedBooking = bookings.find((b) => b.id === excludeBookingId);
    if (excludedBooking) {
      externalBusy = subtractInterval(externalBusy, {
        start: excludedBooking.starts_at,
        end: excludedBooking.ends_at,
      });
    }
  }

  // Filter out the excluded booking when building busy intervals from Zebri's confirmed set
  const bookingBusy: BusyInterval[] = (bookings ?? [])
    .filter((b) => b.id !== excludeBookingId)
    .map((b) => ({
      start: b.starts_at,
      end: b.ends_at,
    }));

  // Merge all busy intervals
  const allBusy = [...externalBusy, ...bookingBusy];

  // Compute slots with merged busy intervals
  const slots = computeSlots(
    {
      timezone: ctx.timezone,
      rules: ctx.rules,
      overrides: ctx.overrides,
      busy: allBusy,
      durationMinutes: ctx.meetingType.duration_minutes,
      bufferBeforeMinutes: ctx.meetingType.buffer_before_minutes,
      bufferAfterMinutes: ctx.meetingType.buffer_after_minutes,
      minNoticeHours: ctx.meetingType.min_notice_hours,
      maxAdvanceDays: ctx.meetingType.max_advance_days,
      now: nowTime,
    },
    range,
  );

  return slots;
}

/**
 * Check if a specific slot is bookable by recomputing that day's slot set
 * and checking exact membership (start time and duration).
 *
 * Returns false if the slot overlaps with busy or has wrong duration.
 * Throws BookingsUnavailableError or FreeBusyUnavailableError if external
 * data cannot be fetched.
 *
 * @param ctx - meeting type context
 * @param start - slot start time (UTC)
 * @param end - slot end time (UTC)
 * @param now - current time (defaults to now)
 * @param excludeBookingId - optional booking id to exclude from busy set.
 *   Why: when rescheduling, the booker's own current booking should not
 *   block them from selecting their existing slot or times near it.
 */
export async function isSlotBookable(
  ctx: BookingContext,
  start: Date,
  end: Date,
  now?: Date,
  excludeBookingId?: string,
): Promise<boolean> {
  // Why: Compute the local date in the MC's timezone, not UTC.
  // A UTC slot on Sunday 23:00Z is Monday 09:00 in Sydney (UTC+10),
  // so we must find the local date to get the correct availability windows.
  const localDateParts = zonedDateParts(start, ctx.timezone);
  const localDate = localDateParts.date;

  // Compute range: local midnight to local midnight of next day
  const dayStart = zonedTimeToUtc(localDate, '00:00', ctx.timezone);
  // Get next day's local date by finding the date 24 hours after dayStart in local time
  const nextDayLocal = zonedDateParts(
    new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
    ctx.timezone,
  ).date;
  const dayEnd = zonedTimeToUtc(nextDayLocal, '00:00', ctx.timezone);

  const slots = await getBookableSlots(
    ctx,
    { start: dayStart, end: dayEnd },
    now,
    excludeBookingId,
  );

  const startIso = start.toISOString().replace(/\.000Z$/, 'Z');
  const endIso = end.toISOString().replace(/\.000Z$/, 'Z');

  // Check exact membership: slot must exist with exact start and end
  return slots.some((slot) => slot.start === startIso && slot.end === endIso);
}
