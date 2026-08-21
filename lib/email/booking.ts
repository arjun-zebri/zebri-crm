/**
 * Booking confirmation and MC notification emails.
 *
 * Used by the scheduler (Task 7: calendar confirmation). Couple receives
 * confirmation in their timezone; MC receives notification via DEFAULT_FROM
 * with booker email as reply-to.
 *
 * @module lib/email/booking
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { dispatchEmail, type DispatchResult } from './dispatch';
import {
  bookingCancelledHtml,
  bookingChangeNotificationHtml,
  bookingConfirmationHtml,
  bookingNotificationHtml,
  bookingReminderHtml,
  bookingRescheduledHtml,
} from './html';
import { DEFAULT_FROM, resolveSender } from './sender-identity';

/**
 * Send a booking confirmation email to the couple.
 * Rendered in the booker's timezone; sent via the MC's connected mailbox
 * (if available) or the shared Zebri address.
 * Includes a manage link for rescheduling or cancelling the booking.
 */
export async function sendBookingConfirmationEmail(
  supabase: SupabaseClient<Database>,
  opts: {
    userId: string;
    businessName: string;
    to: string;
    bookerName: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: 'video' | 'phone' | 'in_person';
    address: string | null;
    joinUrl: string | null;
    manageUrl: string;
  },
): Promise<DispatchResult> {
  const sender = await resolveSender(supabase, opts.userId, opts.businessName);

  return dispatchEmail(sender, {
    to: opts.to,
    subject: `Booking confirmed: ${opts.meetingTypeName}`,
    html: bookingConfirmationHtml({
      bookerName: opts.bookerName,
      meetingTypeName: opts.meetingTypeName,
      start: opts.start,
      end: opts.end,
      timezone: opts.timezone,
      locationType: opts.locationType,
      address: opts.address,
      joinUrl: opts.joinUrl,
      mcBusinessName: opts.businessName,
      manageUrl: opts.manageUrl,
    }),
  });
}

/**
 * Send an ops email to the MC notifying them of a new booking.
 * Mirroring `sendLeadNotificationEmail` structure: DEFAULT_FROM, table layout,
 * booker email as reply-to.
 */
export async function sendBookingNotificationEmail(opts: {
  to: string;
  mcBusinessName: string;
  booking: {
    bookerName: string;
    bookerEmail: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: 'video' | 'phone' | 'in_person';
    address: string | null;
    joinUrl: string | null;
  };
}): Promise<DispatchResult> {
  return dispatchEmail(
    { transport: 'resend', from: DEFAULT_FROM },
    {
      to: opts.to,
      replyTo: opts.booking.bookerEmail,
      subject: `New booking: ${opts.booking.meetingTypeName}`,
      html: bookingNotificationHtml({
        mcBusinessName: opts.mcBusinessName,
        booking: opts.booking,
      }),
    },
  );
}

/**
 * Send a booking rescheduled email to the couple.
 * Shows the old time (struck through) and new time in the booker's timezone.
 * Sent via the MC's connected mailbox (if available) or the shared Zebri address.
 */
export async function sendBookingRescheduledEmail(
  supabase: SupabaseClient<Database>,
  opts: {
    userId: string;
    businessName: string;
    to: string;
    bookerName: string;
    meetingTypeName: string;
    previousStart: Date;
    start: Date;
    end: Date;
    timezone: string;
    locationType: 'video' | 'phone' | 'in_person';
    address: string | null;
    joinUrl: string | null;
    manageUrl: string;
  },
): Promise<DispatchResult> {
  const sender = await resolveSender(supabase, opts.userId, opts.businessName);

  return dispatchEmail(sender, {
    to: opts.to,
    subject: `Booking rescheduled: ${opts.meetingTypeName}`,
    html: bookingRescheduledHtml({
      bookerName: opts.bookerName,
      meetingTypeName: opts.meetingTypeName,
      previousStart: opts.previousStart,
      start: opts.start,
      end: opts.end,
      timezone: opts.timezone,
      locationType: opts.locationType,
      address: opts.address,
      joinUrl: opts.joinUrl,
      mcBusinessName: opts.businessName,
      manageUrl: opts.manageUrl,
    }),
  });
}

/**
 * Send a booking cancelled email to the couple.
 * Confirms the cancellation with the meeting type and cancelled time.
 * Sent via the MC's connected mailbox (if available) or the shared Zebri address.
 */
export async function sendBookingCancelledEmail(
  supabase: SupabaseClient<Database>,
  opts: {
    userId: string;
    businessName: string;
    to: string;
    bookerName: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: 'video' | 'phone' | 'in_person';
    address: string | null;
    joinUrl: string | null;
  },
): Promise<DispatchResult> {
  const sender = await resolveSender(supabase, opts.userId, opts.businessName);

  return dispatchEmail(sender, {
    to: opts.to,
    subject: `Booking cancelled: ${opts.meetingTypeName}`,
    html: bookingCancelledHtml({
      bookerName: opts.bookerName,
      meetingTypeName: opts.meetingTypeName,
      start: opts.start,
      end: opts.end,
      timezone: opts.timezone,
      locationType: opts.locationType,
      address: opts.address,
      joinUrl: opts.joinUrl,
      mcBusinessName: opts.businessName,
    }),
  });
}

/**
 * Send an MC ops notification email for a booking change (reschedule or cancel).
 * Sent from DEFAULT_FROM with booker email as reply-to.
 * Times rendered in the MC's timezone. Subject and body differ by kind.
 */
export async function sendBookingChangeNotificationEmail(opts: {
  to: string;
  mcBusinessName: string;
  kind: 'rescheduled' | 'cancelled';
  booking: {
    bookerName: string;
    bookerEmail: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: 'video' | 'phone' | 'in_person';
    address: string | null;
    joinUrl: string | null;
  };
}): Promise<DispatchResult> {
  const subjectAction = opts.kind === 'rescheduled' ? 'rescheduled' : 'cancelled';

  return dispatchEmail(
    { transport: 'resend', from: DEFAULT_FROM },
    {
      to: opts.to,
      replyTo: opts.booking.bookerEmail,
      subject: `Booking ${subjectAction}: ${opts.booking.meetingTypeName}`,
      html: bookingChangeNotificationHtml({
        mcBusinessName: opts.mcBusinessName,
        kind: opts.kind,
        booking: opts.booking,
      }),
    },
  );
}

/**
 * Send a booking reminder email to the couple the day before their meeting.
 * Rendered in the booker's timezone; sent via the MC's connected mailbox
 * (if available) or the shared Zebri address.
 * Includes a manage link for rescheduling or cancelling.
 */
export async function sendBookingReminderEmail(
  supabase: SupabaseClient<Database>,
  opts: {
    userId: string;
    businessName: string;
    to: string;
    bookerName: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: 'video' | 'phone' | 'in_person';
    address: string | null;
    joinUrl: string | null;
    manageUrl: string;
  },
): Promise<DispatchResult> {
  const sender = await resolveSender(supabase, opts.userId, opts.businessName);

  return dispatchEmail(sender, {
    to: opts.to,
    subject: `Reminder: Your meeting tomorrow`,
    html: bookingReminderHtml({
      bookerName: opts.bookerName,
      meetingTypeName: opts.meetingTypeName,
      start: opts.start,
      end: opts.end,
      timezone: opts.timezone,
      locationType: opts.locationType,
      address: opts.address,
      joinUrl: opts.joinUrl,
      mcBusinessName: opts.businessName,
      manageUrl: opts.manageUrl,
    }),
  });
}
