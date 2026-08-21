/**
 * Month calendar for the public booking page.
 *
 * Renders a 6-week grid with previous/next month navigation. Days with available slots
 * are highlighted with a soft background in the MC's brand color; the selected day is
 * shown with a solid filled circle. Days without slots are plain and not clickable.
 *
 * @module app/book/[token]/booking-month-calendar
 */

'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'

export interface BookingMonthCalendarProps {
  /** Current month being displayed (YYYY-MM-DD format; only YYYY-MM is used). */
  currentMonth: string
  /** Set of available date strings (YYYY-MM-DD) from the fetched slots. */
  availableDates: Set<string>
  /** Currently selected date (YYYY-MM-DD format). */
  selectedDate: string | null
  /** MC's brand color for highlighting available days. */
  brandColor: string
  /** Callback when user clicks a day with availability. */
  onSelectDate: (date: string) => void
  /** Callback to navigate to previous month. */
  onPreviousMonth: () => void
  /** Callback to navigate to next month. */
  onNextMonth: () => void
}

/** Days of week header (abbreviated). */
const WEEKDAY_HEADER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Get all dates to display for a given month (6-week grid with pre/post days).
 */
function getMonthDates(yearMonth: string): { date: Date; isCurrentMonth: boolean }[] {
  const [year, month] = yearMonth.split('-').map(Number)
  const first = new Date(Date.UTC(year!, month! - 1, 1))
  const startDate = new Date(first)
  startDate.setUTCDate(startDate.getUTCDate() - first.getUTCDay())

  const dates: { date: Date; isCurrentMonth: boolean }[] = []
  const current = new Date(startDate)

  while (dates.length < 42) {
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
  brandColor,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: BookingMonthCalendarProps) {
  const monthDates = useMemo(() => getMonthDates(currentMonth), [currentMonth])

  const [year, month] = currentMonth.split('-').map(Number)
  const monthName = new Date(Date.UTC(year!, month! - 1, 15)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Month header with navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPreviousMonth}
          className="p-1 hover:bg-surface-muted rounded-control transition-colors cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} strokeWidth={1.5} className="text-text" />
        </button>
        <h3 className="text-sm font-semibold text-text">{monthName}</h3>
        <button
          onClick={onNextMonth}
          className="p-1 hover:bg-surface-muted rounded-control transition-colors cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight size={20} strokeWidth={1.5} className="text-text" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_HEADER.map((day) => (
          <div key={day} className="text-xs text-text-muted text-center font-semibold py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Date grid with circular indicators */}
      <div className="grid grid-cols-7 gap-2">
        {monthDates.map((item, idx) => {
          const dateStr = dateToString(item.date)
          const hasSlots = availableDates.has(dateStr)
          const isSelected = selectedDate === dateStr
          const day = item.date.getUTCDate()

          if (!item.isCurrentMonth) {
            return (
              <div key={idx} className="aspect-square flex items-center justify-center">
                <span className="text-xs text-text-muted">{day}</span>
              </div>
            )
          }

          if (isSelected) {
            return (
              <button
                key={idx}
                onClick={() => onSelectDate(dateStr)}
                className="aspect-square flex items-center justify-center rounded-pill text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: brandColor }}
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
                className="aspect-square flex items-center justify-center rounded-pill text-xs font-semibold text-text transition-all hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: `${brandColor}20`, // 20% opacity for subtle tint
                }}
                aria-label={`Available ${dateStr}`}
              >
                {day}
              </button>
            )
          }

          return (
            <div key={idx} className="aspect-square flex items-center justify-center">
              <span className="text-xs text-text-muted">{day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
