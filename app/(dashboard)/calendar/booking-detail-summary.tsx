'use client';

import { AlertTriangle } from 'lucide-react';

import {
  formatCountdown,
  formatFullDate,
  formatTimeRange,
  locationLabel,
} from './booking-display';
import type { Booking } from './use-bookings';

/** Title an MC recognises at a glance: what the meeting is, and with whom. */
export function bookingTitle(booking: Booking): string {
  return `${booking.meeting_type?.name ?? 'Meeting'} with ${booking.name}`;
}

export interface BookingDetailSummaryProps {
  booking: Booking;
  /** MC's timezone. Every time on this surface is theirs. */
  timeZone: string;
}

/**
 * The hero of the booking modal: the meeting's name and, under it, one quiet
 * line saying when it is, how long it runs and how it happens.
 *
 * Same shape as the builder modals: a `text-section` title with a muted meta
 * line beneath, rather than a headline and a stack of separate rows. Join and
 * Copy link are not here; they live in the modal header, where the builders
 * put their contextual actions.
 *
 * @module app/(dashboard)/calendar/booking-detail-summary
 */
export function BookingDetailSummary({ booking, timeZone }: BookingDetailSummaryProps) {
  const now = new Date();
  const hasEnded = new Date(booking.ends_at).getTime() < now.getTime();
  const countdown = formatCountdown(booking, now);

  const shape = booking.meeting_type
    ? `${booking.meeting_type.duration_minutes} min · ${locationLabel(booking.meeting_type.location_type)}`
    : '';

  // A video call with nothing to join. The calendar push accepted the
  // event but minted no link (Outlook without Teams, or no calendar at
  // all), and the couple's confirmation already says "link to follow", so
  // the MC is the only one who can still make the call happen.
  const missingLink =
    booking.meeting_type?.location_type === 'video' &&
    !booking.video_join_url &&
    booking.status !== 'cancelled';

  return (
    <div>
      <h3 className="text-section font-semibold text-text" data-testid="booking-meeting-type">
        {bookingTitle(booking)}
      </h3>

      <p className="mt-1 text-body text-text-muted tabular-nums" data-testid="booking-time">
        {formatFullDate(booking.starts_at, timeZone)} ·{' '}
        {formatTimeRange(booking.starts_at, booking.ends_at, timeZone)}
        {shape && ` · ${shape}`}
      </p>

      {countdown && (
        <p className={`mt-1 text-body ${hasEnded ? 'text-text-subtle' : 'text-success'}`}>
          {countdown}
        </p>
      )}

      {missingLink && (
        <p className="mt-2 flex items-start gap-2 text-body text-text" role="status">
          <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning" />
          No video link was created for this booking, so the couple has none. Send them one
          before the call.
        </p>
      )}
    </div>
  );
}
