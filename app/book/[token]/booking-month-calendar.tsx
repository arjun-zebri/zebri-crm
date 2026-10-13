/**
 * Month calendar for the public booking page.
 *
 * Renders a 6-week grid with previous/next month navigation. Days with available slots
 * carry a soft tint of the brand colour; the selected day is a solid brand-coloured
 * circle. Days without slots are plain and not clickable.
 *
 * @module app/book/[token]/booking-month-calendar
 */

'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'

export interface BookingMonthCalendarProps {
  /** Current month being displayed (YYYY-MM-DD format; only YYYY-MM is used). */
  currentMonth: string
  /** Set of available date strings (YYYY-MM-DD) from the fetched slots. */
  availableDates: Set<string>
  /** Currently selected date (YYYY-MM-DD format). */
  selectedDate: string | null
  /** Callback when user clicks a day with availability. */
  onSelectDate: (date: string) => void
  /** Callback to navigate to previous month. */
  onPreviousMonth: () => void
  /** Callback to navigate to next month. */
  onNextMonth: () => void
  /** Locale for the month name, e.g. `en-AU`. */
  locale: string
}

/** Days of week header (abbreviated). Sunday first, matching the grid below. */
const WEEKDAY_HEADER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Get the dates to display for a given month: whole weeks, from the week of
 * the 1st to the week of the last day. A fixed six-week grid added a row of
 * next month's dates most months, which on a phone pushed the times further
 * below the fold for nothing.
 */
function getMonthDates(yearMonth: string): { date: Date; isCurrentMonth: boolean }[] {
  const [year, month] = yearMonth.split('-').map(Number)
  const first = new Date(Date.UTC(year!, month! - 1, 1))
  const startDate = new Date(first)
  startDate.setUTCDate(startDate.getUTCDate() - first.getUTCDay())

  const dates: { date: Date; isCurrentMonth: boolean }[] = []
  const current = new Date(startDate)

  const last = new Date(Date.UTC(year!, month!, 0))

  // Run to the end of the week holding the last day of the month.
  while (current <= last || current.getUTCDay() !== 0) {
    const isCurrentMonth =
      current.getUTCMonth() === first.getUTCMonth() &&
      current.getUTCFullYear() === first.getUTCFullYear()
    dates.push({ date: new Date(current), isCurrentMonth })
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

/** Format YYYY-MM-DD from a Date in UTC. */
function dateToString(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Renders a calendar grid with circular day indicators.
 */
export function BookingMonthCalendar({
  currentMonth,
  availableDates,
  selectedDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  locale,
}: BookingMonthCalendarProps) {
  const monthDates = useMemo(() => getMonthDates(currentMonth), [currentMonth])

  const [year, month] = currentMonth.split('-').map(Number)
  const monthName = new Date(Date.UTC(year!, month! - 1, 15)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Month header with navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" iconOnly onClick={onPreviousMonth} aria-label="Previous month">
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <h3 className="text-body font-semibold text-text">{monthName}</h3>
        <Button variant="ghost" iconOnly onClick={onNextMonth} aria-label="Next month">
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_HEADER.map((day) => (
          <div key={day} className="py-1 text-center text-body font-semibold text-text-muted">
            {day}
          </div>
        ))}
      </div>

      {/* Date grid with circular indicators */}
      <div className="grid grid-cols-7 gap-x-2 gap-y-1">
        {monthDates.map((item, idx) => {
          const dateStr = dateToString(item.date)
          const hasSlots = availableDates.has(dateStr)
          const isSelected = selectedDate === dateStr
          const day = item.date.getUTCDate()

          if (!item.isCurrentMonth) {
            return (
              <div key={idx} className="mx-auto flex aspect-square w-full max-w-10 items-center justify-center">
                <span className="text-body text-text-subtle">{day}</span>
              </div>
            )
          }

          if (isSelected) {
            return (
              <button
                key={idx}
                onClick={() => onSelectDate(dateStr)}
                className="mx-auto flex aspect-square w-full max-w-10 items-center justify-center rounded-pill bg-brand-fg text-body font-semibold text-brand-bg transition-opacity hover:opacity-90 cursor-pointer"
                aria-label={`Selected ${dateStr}`}
              >
                {day}
              </button>
            )
          }

          if (hasSlots) {
            return (
              <button
                key={idx}
                onClick={() => onSelectDate(dateStr)}
                className="mx-auto flex aspect-square w-full max-w-10 items-center justify-center rounded-pill bg-brand-fg/10 text-body font-semibold text-text transition-colors hover:bg-brand-fg/20 cursor-pointer"
                aria-label={`Available ${dateStr}`}
              >
                {day}
              </button>
            )
          }

          return (
            <div key={idx} className="mx-auto flex aspect-square w-full max-w-10 items-center justify-center">
              <span className="text-body text-text-subtle">{day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
