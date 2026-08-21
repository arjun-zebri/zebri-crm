'use client';

import { ChevronRight } from 'lucide-react';

import { StatePill } from '@/components/ui/state-pill';
import type { Booking } from './use-bookings';

interface BookingRowProps {
  booking: Booking;
  formattedTime: string;
  formattedDate: string;
  onClick: () => void;
}

/**
 * Single booking row showing date, time, booker name, meeting type,
 * status pill, and optional couple. Renders as a clickable button.
 *
 * @module app/(dashboard)/calendar/booking-row
 */
export function BookingRow({
  booking,
  formattedTime,
  formattedDate,
  onClick,
}: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';
  const rowClass = `flex items-center gap-3 p-3 bg-surface rounded-control border border-border cursor-pointer transition ${
    isCancelled ? 'opacity-60 hover:opacity-70' : 'hover:bg-surface-muted'
  }`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={rowClass}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-body font-medium ${isCancelled ? 'text-text-muted' : 'text-text'}`}>
            {booking.name}
          </span>
          <StatePill
            label={booking.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
            tone={booking.status === 'cancelled' ? 'neutral' : 'success'}
            dot="filled"
          />
        </div>
        <div className={`flex items-center gap-2 text-text-muted text-body`}>
          <span>{formattedDate}</span>
          <span className="text-text-subtle">-</span>
          <span>{formattedTime}</span>
          {booking.meeting_type ? (
            <>
              <span className="text-text-subtle">-</span>
              <span>{booking.meeting_type.name}</span>
            </>
          ) : null}
        </div>
        {booking.couple ? (
          <p className="text-body text-text-subtle mt-1">Couple: {booking.couple.name}</p>
        ) : null}
      </div>

      <ChevronRight
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-text-muted"
        aria-hidden="true"
      />
    </button>
  );
}
