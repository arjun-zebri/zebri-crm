/**
 * A positioned, clickable booking chip for the day-view hour grid.
 *
 * Renders a single booking as a chip positioned by start/end times,
 * showing the booker name and meeting type. Cancelled bookings are not
 * rendered; completed bookings are muted.
 *
 * @module app/(dashboard)/calendar/_components/grid-booking-chip
 */
import { bandGeometry, type GridConfig } from '@/lib/calendar/grid-layout';

import type { Booking } from '../use-bookings';

/**
 * Props for GridBookingChip.
 */
export interface GridBookingChipProps {
  /** The booking to render. */
  booking: Booking;
  /** Index within the layout group (col in layoutOverlaps result). */
  colIndex: number;
  /** Total columns in the overlap group. */
  totalCols: number;
  /** Start of the day (for computing grid positions). */
  dayStart: Date;
  /** Grid configuration. */
  gridConfig: GridConfig;
  /** Callback when chip is clicked. */
  onSelectBooking: (booking: Booking) => void;
  /** Optional data-testid override (for week view column identification). */
  'data-testid'?: string;
}

/**
 * A positioned booking chip.
 *
 * Renders at the position computed by bandGeometry, with width divided by totalCols
 * and left-offset by colIndex. Completed bookings are muted (lower opacity).
 * Cancelled bookings are not rendered (filtering happens at the parent level).
 *
 * @param props - GridBookingChipProps
 * @returns JSX element
 */
export function GridBookingChip({
  booking,
  colIndex,
  totalCols,
  dayStart,
  gridConfig,
  onSelectBooking,
  'data-testid': dataTestId,
}: GridBookingChipProps) {
  const geometry = bandGeometry(
    {
      start: booking.starts_at,
      end: booking.ends_at,
    },
    dayStart,
    gridConfig,
  );

  if (!geometry) return null;

  const isCompleted = booking.status === 'completed';
  const colWidthPercent = 100 / totalCols;
  const leftPercent = (colIndex / totalCols) * 100;

  return (
    <button
      onClick={() => onSelectBooking(booking)}
      // Tinted with a solid left rule, the same language as the external busy
      // blocks, so the two read as related kinds of commitment in different
      // colours. Not bg-brand-bg: that token is pure white, and a white chip on
      // a near-white grid was indistinguishable from an empty slot.
      //
      // bg-surface underneath is load-bearing. The tint is only 10% opaque, so
      // without an opaque base the warning-coloured busy block sitting beneath
      // a booking showed straight through and the chip read as orange.
      className={`
        absolute cursor-pointer rounded-r-control border-l-2 bg-surface
        transition hover:shadow-md
        ${isCompleted ? 'border-border text-text-muted' : 'border-info text-text'}
        p-2 text-body overflow-hidden text-left
      `}
      style={{
        top: `${geometry.topPx}px`,
        height: `${geometry.heightPx}px`,
        left: `${leftPercent}%`,
        width: `${colWidthPercent}%`,
      }}
      data-testid={dataTestId || 'grid-booking-chip'}
    >
      {/* The tint rides on its own layer so the opaque base still shows. */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none ${
          isCompleted ? 'bg-surface-muted' : 'bg-info/10'
        }`}
      />
      <div className="relative truncate font-medium">
        {booking.couple?.name || booking.name}
      </div>
      {booking.meeting_type && (
        <div className="relative truncate text-text-muted">{booking.meeting_type.name}</div>
      )}
    </button>
  );
}
