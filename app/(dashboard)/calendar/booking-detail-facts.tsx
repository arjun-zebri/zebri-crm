'use client';

import type { ReactNode } from 'react';

import { formatShortDate } from './booking-display';
import type { Booking } from './use-bookings';

/**
 * One detail row: label on the left, value on the right.
 *
 * Same row as the couple profile's Overview column, so a booking reads like
 * the rest of the app rather than like a form someone pasted in.
 */
function Row({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="w-28 shrink-0 text-body text-text-muted">{label}</span>
      <span
        className="min-w-0 flex-1 truncate text-right text-body text-text"
        {...(testId && { 'data-testid': testId })}
      >
        {children}
      </span>
    </div>
  );
}

export interface BookingDetailFactsProps {
  booking: Booking;
  /** MC's timezone, used for the "Booked" date. */
  timeZone: string;
  /** Opens the couple's profile. Omit to render the couple as plain text. */
  onSelectCouple?: (coupleId: string) => void;
}

/**
 * Who booked, how to reach them, and where the booking came from.
 *
 * Only facts about the person: what the meeting is and how long it runs are
 * said once, in the hero above. The booker's own timezone is shown only when
 * it differs from the MC's, since it is noise on the majority of bookings and
 * the one thing worth knowing on an interstate one.
 *
 * @module app/(dashboard)/calendar/booking-detail-facts
 */
export function BookingDetailFacts({
  booking,
  timeZone,
  onSelectCouple,
}: BookingDetailFactsProps) {
  const couple = booking.couple;

  return (
    <div>
      <h4 className="text-body font-semibold uppercase tracking-wider text-text">Details</h4>

      <div className="mt-1 divide-y divide-border">
        <Row label="Name" testId="booking-name">
          {booking.name}
        </Row>

        {booking.email && (
          <Row label="Email">
            <a
              href={`mailto:${booking.email}`}
              className="text-text underline-offset-2 hover:underline"
            >
              {booking.email}
            </a>
          </Row>
        )}

        {booking.phone && (
          <Row label="Phone">
            <a
              href={`tel:${booking.phone}`}
              className="text-text underline-offset-2 hover:underline"
            >
              {booking.phone}
            </a>
          </Row>
        )}

        <Row label="Couple">
          {couple ? (
            onSelectCouple ? (
              <button
                type="button"
                onClick={() => onSelectCouple(couple.id)}
                className="max-w-full truncate text-body text-text underline-offset-2 hover:underline"
              >
                {couple.name}
              </button>
            ) : (
              couple.name
            )
          ) : (
            <span className="text-text-subtle">Not linked yet</span>
          )}
        </Row>

        <Row label="Booked">
          {formatShortDate(booking.created_at, timeZone)}, via booking link
        </Row>

        {booking.timezone && booking.timezone !== timeZone && (
          <Row label="Their timezone">{booking.timezone.replace(/_/g, ' ')}</Row>
        )}
      </div>

      {booking.notes && (
        <div className="mt-6">
          <h4 className="text-body font-semibold uppercase tracking-wider text-text">
            Their note
          </h4>
          <p className="mt-2 whitespace-pre-wrap text-body text-text-muted">{booking.notes}</p>
        </div>
      )}
    </div>
  );
}
