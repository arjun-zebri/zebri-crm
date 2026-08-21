'use client';

import type { BookingDayGroup } from './booking-display';
import { BookingRow } from './booking-row';
import type { Booking } from './use-bookings';

export interface BookingsListProps {
  groups: BookingDayGroup[];
  /** MC's timezone, passed straight through to each row's clock. */
  timeZone: string;
  /** Tint the rows of the current day. Only meaningful for upcoming bookings. */
  highlightToday?: boolean;
  /** Soften the status pill for bookings that have already run. */
  isPast?: boolean;
  /** Closing line under the last row, e.g. "Nothing else booked yet." */
  footer?: string;
  onSelectBooking: (booking: Booking) => void;
}

/**
 * The booking list itself: one bordered card holding day bands and their rows.
 *
 * Kept separate from the tab so the tab stays an orchestrator (fetch, filter,
 * choose a state) and this file owns nothing but layout.
 *
 * @module app/(dashboard)/calendar/bookings-list
 */
export function BookingsList({
  groups,
  timeZone,
  highlightToday = false,
  isPast = false,
  footer,
  onSelectBooking,
}: BookingsListProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-control border border-border">
      {groups.map((group, index) => (
        <div key={group.date}>
          <div
            // Sticky: the card scrolls internally, and a day heading that
            // scrolls away leaves the rows under it unlabelled.
            className={`sticky top-0 z-10 flex items-baseline gap-3 border-b border-border bg-surface-muted px-3 py-2 sm:px-4 ${
              index > 0 ? 'border-t' : ''
            }`}
          >
            <span className="text-body font-medium text-text">{group.heading}</span>
            <span className="text-body text-text-subtle">
              {group.bookings.length} {group.bookings.length === 1 ? 'booking' : 'bookings'}
            </span>
          </div>
          <div className="divide-y divide-border">
            {group.bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                timeZone={timeZone}
                highlight={highlightToday && group.isToday}
                isPast={isPast}
                onClick={() => onSelectBooking(booking)}
              />
            ))}
          </div>
        </div>
      ))}

      {footer && (
        <p className="border-t border-border px-3 py-3 text-body text-text-muted sm:px-4">
          {footer}
        </p>
      )}
    </div>
  );
}
