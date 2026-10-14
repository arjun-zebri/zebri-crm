/**
 * The pick step's content: calendar, times for the chosen day, and the zone
 * control. The MC's details live in the shell's summary column, so this is the
 * right column only.
 *
 * @module app/book/[token]/booking-slot-picker
 */

'use client'

import { BookingMonthCalendar } from './booking-month-calendar'
import { BookingPageSkeleton } from './booking-skeleton'
import { BookingSlotColumn } from './booking-slot-column'
import { BookingTimezoneSelector } from './booking-timezone-selector'
import type { Slot } from './use-booking-page'

export interface BookingSlotPickerProps {
  state: 'loading' | 'ready' | 'error'
  /**
   * True while a slot query is in flight, including when paging to another
   * month. Distinct from `state`, which only covers the initial page load.
   */
  slotsLoading?: boolean
  slotsForSelectedDate: Slot[]
  availableDates: Set<string>
  selectedDate: string | null
  currentMonth: string
  timezone: string
  locale: string
  /** Called with the booker's chosen zone from the timezone control. */
  onChangeTimezone: (timezone: string) => void
  onSelectSlot: (slot: Slot) => void
  onSelectDate: (date: string) => void
  onChangeMonth: (yearMonth: string) => void
}

/**
 * Renders the calendar-first slot picker. Two columns from `lg` up, stacked
 * below that: the calendar, then the day's times and the zone control.
 */
export function BookingSlotPicker({
  state,
  slotsLoading = false,
  slotsForSelectedDate,
  availableDates,
  selectedDate,
  currentMonth,
  timezone,
  locale,
  onChangeTimezone,
  onSelectSlot,
  onSelectDate,
  onChangeMonth,
}: BookingSlotPickerProps) {
  if (state === 'loading') {
    return <BookingPageSkeleton />
  }

  if (state === 'error') {
    return (
      <p className="py-10 text-center text-body text-danger">
        Availability is temporarily unavailable, please try again shortly.
      </p>
    )
  }

  // Still fetching: show the placeholder, not the verdict. An empty slot list
  // mid-request is indistinguishable from a genuinely empty period, and saying
  // the MC has no availability when the answer has not arrived is worse than
  // saying nothing.
  if (slotsLoading) {
    return <BookingPageSkeleton />
  }

  if (availableDates.size === 0) {
    return <p className="py-10 text-center text-body text-text-muted">No times available for this period.</p>
  }

  const handlePreviousMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const prev = new Date(Date.UTC(y!, m! - 1, 0))
    const prevMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
    onChangeMonth(prevMonth)
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const next = new Date(Date.UTC(y!, m! + 1, 1))
    const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
    onChangeMonth(nextMonth)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <BookingMonthCalendar
        currentMonth={currentMonth}
        availableDates={availableDates}
        selectedDate={selectedDate}
        locale={locale}
        onSelectDate={onSelectDate}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
      />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="lg:max-h-96 lg:overflow-y-auto lg:pr-2">
          <BookingSlotColumn
            selectedDate={selectedDate}
            slots={slotsForSelectedDate}
            timezone={timezone}
            locale={locale}
            onSelectSlot={onSelectSlot}
          />
        </div>
        {/* Sits with the times, not in the header: the zone only means
            anything next to the numbers it applies to. */}
        <BookingTimezoneSelector timezone={timezone} onTimezoneChange={onChangeTimezone} />
      </div>
    </div>
  )
}
