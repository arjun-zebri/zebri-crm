/**
 * Slot picker for the public booking page.
 *
 * Three-column layout: left info panel, center calendar, right time slots (scrollable).
 * Times display in MC's timezone. Mobile: stacks vertically.
 *
 * @module app/book/[token]/booking-slot-picker
 */

'use client'

import { BookingInfoPanel } from './booking-info-panel'
import { BookingMonthCalendar } from './booking-month-calendar'
import { BookingPageSkeleton } from './booking-skeleton'
import { BookingSlotColumn } from './booking-slot-column'
import { BookingTimezoneSelector } from './booking-timezone-selector'
import type { BookingPageData, Slot } from './use-booking-page'

export interface BookingSlotPickerProps {
  state: 'loading' | 'ready' | 'error'
  /**
   * True while a slot query is in flight, including when paging to another
   * month. Distinct from `state`, which only covers the initial page load.
   */
  slotsLoading?: boolean
  bookingPage: BookingPageData
  slotsForSelectedDate: Slot[]
  availableDates: Set<string>
  selectedDate: string | null
  currentMonth: string
  timezone: string
  /** Called with the booker's chosen zone from the timezone control. */
  onChangeTimezone: (timezone: string) => void
  onSelectSlot: (slot: Slot) => void
  onSelectDate: (date: string) => void
  onChangeMonth: (yearMonth: string) => void
}

/**
 * Renders the calendar-first slot picker with branded layout.
 */
export function BookingSlotPicker({
  state,
  slotsLoading = false,
  bookingPage,
  slotsForSelectedDate,
  availableDates,
  selectedDate,
  currentMonth,
  timezone,
  onChangeTimezone,
  onSelectSlot,
  onSelectDate,
  onChangeMonth,
}: BookingSlotPickerProps) {
  const brandColor = bookingPage.brand_color || '#000000'

  if (state === 'loading') {
    return <BookingPageSkeleton />
  }

  if (state === 'error') {
    return (
      <p className="text-sm text-danger py-10 text-center">
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
    return (
      <div className="space-y-4 text-center">
        <p className="text-body text-text-muted">No times available for this period.</p>
      </div>
    )
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
    <div className="border border-border rounded-control p-6 lg:p-8 bg-surface">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
        {/* Left column: MC info (narrow) */}
        <div>
          <BookingInfoPanel bookingPage={bookingPage} />
        </div>

        {/* Right area: Calendar and slots (wider, spans 3 columns) */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Calendar */}
            <div>
              <BookingMonthCalendar
                currentMonth={currentMonth}
                availableDates={availableDates}
                selectedDate={selectedDate}
                brandColor={brandColor}
                onSelectDate={onSelectDate}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
              />
            </div>

            {/* Time slots (scrollable) */}
            <div className="flex flex-col gap-3 min-w-0">
              <div className="lg:max-h-96 lg:overflow-y-auto lg:pr-2">
                <BookingSlotColumn
                  selectedDate={selectedDate}
                  slots={slotsForSelectedDate}
                  timezone={timezone}
                  onSelectSlot={onSelectSlot}
                />
              </div>
              {/* Sits with the times, not in the header: the zone only means
                  anything next to the numbers it applies to. */}
              <BookingTimezoneSelector
                timezone={timezone}
                onTimezoneChange={onChangeTimezone}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
