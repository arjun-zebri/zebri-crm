/**
 * Vertical slot list for a selected day on the public booking page.
 *
 * Shows the selected date formatted as "Weekday, Month Day", followed by full-width
 * time buttons for that day only. Each button is clickable to select a time.
 *
 * @module app/book/[token]/booking-slot-column
 */

'use client'

import type { Slot } from './use-booking-page'

export interface BookingSlotColumnProps {
  /** The selected date in YYYY-MM-DD format. */
  selectedDate: string | null
  /** All slots for the selected date (pre-filtered by use-booking-page). */
  slots: Slot[]
  /** IANA timezone for formatting time display. */
  timezone: string
  /** Callback when user clicks a slot. */
  onSelectSlot: (slot: Slot) => void
}

/**
 * Format a time slot as local time without timezone suffix.
 * E.g. "10:00 AM"
 */
function formatSlotTime(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
  return formatter.format(date)
}

/**
 * Extract city name from IANA timezone.
 * E.g. "Sydney time" from "Australia/Sydney"
 */
function getTimezoneName(timezone: string): string {
  const parts = timezone.split('/')
  if (parts.length > 1) {
    return `${parts[parts.length - 1]!.replace(/_/g, ' ')} time`
  }
  return `${timezone.replace(/_/g, ' ')} time`
}

/**
 * Format a date as a weekday + day string.
 * E.g. "Thursday, August 20"
 */
function formatDateHeader(isoDate: string, timezone: string): string {
  const date = new Date(isoDate + 'T00:00:00Z')
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  })
  return formatter.format(date)
}

/**
 * Renders the selected day's slots as a vertical stack of time buttons.
 */
export function BookingSlotColumn({
  selectedDate,
  slots,
  timezone,
  onSelectSlot,
}: BookingSlotColumnProps) {
  if (!selectedDate) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-text-muted">Select a date to see available times</p>
      </div>
    )
  }

  const dateHeader = formatDateHeader(selectedDate, timezone)
  const tzName = getTimezoneName(timezone)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text">{dateHeader}</p>
        <p className="text-xs text-text-muted mt-1">All times are in {tzName}</p>
      </div>

      <div className="space-y-2">
        {slots.length > 0 ? (
          slots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => onSelectSlot(slot)}
              className="w-full px-3 py-2 rounded-control border border-border text-sm font-medium text-text hover:bg-surface-emphasis transition-colors cursor-pointer text-center"
            >
              {formatSlotTime(slot.start, timezone)}
            </button>
          ))
        ) : (
          <p className="text-sm text-text-muted text-center py-4">No times available for this day</p>
        )}
      </div>
    </div>
  )
}
