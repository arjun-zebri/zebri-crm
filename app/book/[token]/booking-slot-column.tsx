/**
 * Vertical slot list for a selected day on the public booking page.
 *
 * Shows the selected date formatted as "Weekday, Month Day", followed by full-width
 * time buttons for that day only. Each button is clickable to select a time.
 *
 * @module app/book/[token]/booking-slot-column
 */

'use client'

import { Button } from '@/components/ui/button'
import { formatBookingDate, formatTimeOfDay } from '@/lib/booking/format-time'

import type { Slot } from './use-booking-page'

export interface BookingSlotColumnProps {
  /** The selected date in YYYY-MM-DD format. */
  selectedDate: string | null
  /** All slots for the selected date (pre-filtered by use-booking-page). */
  slots: Slot[]
  /** IANA timezone for formatting time display. */
  timezone: string
  /** Locale for the day header and times, e.g. `en-AU`. */
  locale: string
  /** Callback when user clicks a slot. */
  onSelectSlot: (slot: Slot) => void
}

/** Extract the city from an IANA zone for the "All times are in" line. */
function getTimezoneName(timezone: string): string {
  const parts = timezone.split('/')
  if (parts.length > 1) {
    return `${parts[parts.length - 1]!.replace(/_/g, ' ')} time`
  }
  return `${timezone.replace(/_/g, ' ')} time`
}

/**
 * Renders the selected day's slots as a vertical stack of time buttons.
 */
export function BookingSlotColumn({
  selectedDate,
  slots,
  timezone,
  locale,
  onSelectSlot,
}: BookingSlotColumnProps) {
  if (!selectedDate) {
    return (
      <div className="py-6 text-center">
        <p className="text-body text-text-muted">Select a date to see available times</p>
      </div>
    )
  }

  // The date is a calendar day, not an instant: noon UTC keeps it on the same
  // day in every zone the picker can show.
  const dateHeader = formatBookingDate(`${selectedDate}T12:00:00Z`, 'UTC', locale)
  const tzName = getTimezoneName(timezone)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-body font-semibold text-text">{dateHeader}</p>
        <p className="mt-1 text-body text-text-muted">All times are in {tzName}</p>
      </div>

      {/* Two columns on a phone, so a long day of times fits a screen without a long scroll. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {slots.length > 0 ? (
          slots.map((slot) => (
            <Button key={slot.start} variant="outline" className="w-full" onClick={() => onSelectSlot(slot)}>
              {formatTimeOfDay(slot.start, timezone, locale)}
            </Button>
          ))
        ) : (
          <p className="col-span-full py-4 text-center text-body text-text-muted">No times available for this day</p>
        )}
      </div>
    </div>
  )
}
