'use client';

import { ChevronRight } from 'lucide-react';

import { StatePill } from '@/components/ui/state-pill';

import { formatTime, locationLabel } from './booking-display';
import type { Booking } from './use-bookings';

/** Status pill wording and tone, keyed by the booking's stored status. */
function statusPill(booking: Booking, isPast: boolean) {
  if (booking.status === 'cancelled') return { label: 'Cancelled', tone: 'neutral' as const };
  if (isPast) return { label: 'Done', tone: 'neutral' as const };
  return { label: 'Confirmed', tone: 'success' as const };
}

export interface BookingRowProps {
  booking: Booking;
  /** MC's timezone. The row's clock time is theirs, not the booker's. */
  timeZone: string;
  /** Tints the row so the day in progress stands out in a long list. */
  highlight?: boolean;
  /** Whether the booking has already finished. Softens the pill wording. */
  isPast?: boolean;
  onClick: () => void;
}

/**
 * One booking in the list: start time, who booked, what they booked, the
 * couple it belongs to, and its status.
 *
 * The time leads the row because an MC scanning their diary reads down the
 * clock column first; the meeting type and length sit under the name as one
 * quiet line rather than three competing ones.
 *
 * @module app/(dashboard)/calendar/booking-row
 */
export function BookingRow({
  booking,
  timeZone,
  highlight = false,
  isPast = false,
  onClick,
}: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';
  const pill = statusPill(booking, isPast);

  const detail = [
    booking.meeting_type?.name,
    booking.meeting_type ? `${booking.meeting_type.duration_minutes} min` : null,
    locationLabel(booking.meeting_type?.location_type),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`booking-row-${booking.id}`}
      className={`flex w-full items-center gap-4 px-3 py-3 text-left transition sm:px-4 ${
        highlight ? 'bg-success/5 hover:bg-success/10' : 'hover:bg-surface-muted'
      } ${isCancelled ? 'opacity-70' : ''}`}
    >
      <span
        className={`w-16 shrink-0 text-body tabular-nums sm:w-20 ${
          isCancelled ? 'text-text-subtle line-through' : 'text-text-muted'
        }`}
      >
        {formatTime(booking.starts_at, timeZone)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-text">{booking.name}</span>
        {detail && <span className="block truncate text-body text-text-muted">{detail}</span>}
      </span>

      {/* Couple column folds away on phones, where the name and time matter
          more than the link back to the couple record. */}
      <span className="hidden min-w-0 flex-1 truncate text-body text-text-muted md:block">
        {booking.couple ? `Couple: ${booking.couple.name}` : 'New enquiry'}
      </span>

      <StatePill label={pill.label} tone={pill.tone} dot="filled" className="shrink-0" />

      <ChevronRight
        size={16}
        strokeWidth={1.5}
        className="hidden shrink-0 text-text-subtle sm:block"
        aria-hidden="true"
      />
    </button>
  );
}
