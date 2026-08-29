'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { isChromePress } from './use-overlay'

interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  /** Render the calendar inline (in-flow below the trigger, no portal) */
  inline?: boolean
  /** Render only the calendar body without trigger or portal */
  calendarOnly?: boolean
  disabled?: boolean
  /** Where the calendar icon sits inside the trigger. Defaults to
   *  'right' for backward-compat; the builder modals pass 'left' to
   *  match their other meta-row controls. */
  iconPosition?: 'left' | 'right'
  /** Optional prefix prepended to the formatted date when a value
   *  is set (e.g. 'Expires' → "Expires 31 May 2026"). Used by the
   *  builder modals to make the date's purpose obvious at a glance. */
  displayPrefix?: string
  /** Month/year to open the calendar to when no value is set.
   *  YYYY-MM-DD. Falls back to today. Used by the event modal to
   *  scroll to the couple's existing event date when adding a second
   *  event on the same day. */
  defaultViewDate?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseYMD(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(s: string): string {
  const d = parseYMD(s)
  if (!d) return ''
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`
}

function buildCalendarGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Date[] = []

  for (let i = offset - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i))
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }
  let nextDay = 1
  while (cells.length < 42) {
    cells.push(new Date(year, month + 1, nextDay++))
  }

  const grid: Date[][] = []
  for (let row = 0; row < 6; row++) {
    grid.push(cells.slice(row * 7, row * 7 + 7))
  }
  return grid
}

// ─── Component ───────────────────────────────────────────────────────────────

const DROPDOWN_HEIGHT = 330

/**
 * Width bounds for the calendar. The day cells are `aspect-square`, so
 * width drives height: matched to a full-width date field the calendar
 * would inflate into 60px tiles. The floor keeps seven columns legible
 * under a narrow trigger.
 */
const DROPDOWN_WIDTH = { min: 220, max: 264 } as const

/** Calendar width for a trigger of `triggerWidth`, clamped to the band. */
function calendarWidth(triggerWidth: number): number {
  return Math.min(DROPDOWN_WIDTH.max, Math.max(DROPDOWN_WIDTH.min, triggerWidth))
}

export function DatePicker({ value, onChange, placeholder, className, inline, calendarOnly, disabled, iconPosition = 'right', displayPrefix, defaultViewDate }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      const d = value ? parseYMD(value) : null
      const fallback = defaultViewDate ? parseYMD(defaultViewDate) : null
      const ref = d ?? fallback ?? new Date()
      setViewYear(ref.getFullYear())
      setViewMonth(ref.getMonth())

      if (!inline && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const top = spaceBelow < DROPDOWN_HEIGHT
          ? rect.top - DROPDOWN_HEIGHT - 4
          : rect.bottom + 4

        // Match the trigger width so the calendar lines up with the
        // input it belongs to, within the calendar's width band.
        const width = calendarWidth(rect.width)
        const left = rect.left + width > window.innerWidth - 8
          ? Math.max(8, rect.right - width)
          : rect.left

        setDropdownPos({ top, left, width })
      }
    }
  }, [open, value, inline])

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const inContainer = containerRef.current?.contains(e.target as Node) || isChromePress(e.target)
      if (!inContainer) setOpen(false)
    }
    if (inline && open) {
      document.addEventListener('mousedown', handleMouseDown)
      return () => document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open, inline])

  useEffect(() => {
    if (inline) return
    const handleMouseDown = (e: MouseEvent) => {
      const inTrigger = containerRef.current?.contains(e.target as Node) || isChromePress(e.target)
      const inDropdown = dropdownRef.current?.contains(e.target as Node)
      if (!inTrigger && !inDropdown) setOpen(false)
    }
    const handleScroll = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const top = spaceBelow < DROPDOWN_HEIGHT
          ? rect.top - DROPDOWN_HEIGHT - 4
          : rect.bottom + 4
        // Same clamp as the open-time measurement: without the upper
        // bound the calendar would widen the moment the page scrolled.
        const width = calendarWidth(rect.width)
        const left = rect.left + width > window.innerWidth - 8
          ? Math.max(8, rect.right - width)
          : rect.left
        setDropdownPos({ top, left, width })
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('scroll', handleScroll, { capture: true })
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [open, inline])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (date: Date) => {
    onChange(toYMD(date))
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setOpen(false)
  }

  const todayYMD = toYMD(new Date())
  const grid = buildCalendarGrid(viewYear, viewMonth)

  const getCellClass = (date: Date) => {
    const ymd = toYMD(date)
    const isSelected = value && ymd === value
    const isToday = ymd === todayYMD
    const isCurrentMonth = date.getMonth() === viewMonth

    const base =
      'w-full aspect-square flex items-center justify-center text-body rounded-control cursor-pointer transition'
    if (isSelected) return `${base} bg-black text-white`
    if (isToday) return `${base} bg-surface-emphasis text-text hover:bg-gray-200`
    if (!isCurrentMonth) return `${base} text-gray-300 hover:bg-gray-50`
    return `${base} text-text hover:bg-gray-50`
  }

  const triggerLayout =
    iconPosition === 'left' ? 'justify-start gap-2' : 'justify-between'
  // One treatment. `underline` (flat bottom-rule, for the couple/event
  // modals) and `meta` (builder meta rows) were removed on 2026-08-07:
  // three chromes for one control meant a date field looked like a
  // different species depending on which form it landed in, and `meta`
  // was 34px against everything else's 32px. This is the `Input`
  // geometry exactly, so a date field reads as a sibling of the text
  // fields beside it.
  const baseChrome = 'border rounded-control px-2.5 h-8 bg-surface'
  // Same focus treatment as `Input`: the border darkens, no ring. A ring
  // of the same colour stacks on the border and renders a doubled edge
  // at the corners.
  const stateChrome = disabled
    ? 'border-border bg-surface-muted text-text-subtle cursor-not-allowed'
    : open
    ? 'border-border-strong'
    : 'border-border hover:bg-surface-muted focus-visible:border-brand-fg'
  const triggerClass = `flex items-center ${triggerLayout} w-full text-body focus:outline-none transition-colors cursor-pointer ${baseChrome} ${stateChrome} ${className ?? ''}`

  const calendarIcon = (
    <CalendarDays className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" strokeWidth={1.5} />
  )
  const displayedValue = value
    ? displayPrefix
      ? `${displayPrefix} ${formatDisplay(value)}`
      : formatDisplay(value)
    : (placeholder ?? 'Select date')
  // Always truncate: the trigger is a fixed-height control, so a long
  // prefixed value ("Expires 31 December 2026") must clip rather than wrap.
  const valueClass = value ? 'text-text truncate' : 'text-text-subtle truncate'
  const triggerContent = (
    <>
      {iconPosition === 'left' ? calendarIcon : null}
      <span className={valueClass}>
        {displayedValue}
      </span>
      {iconPosition === 'right' ? calendarIcon : null}
    </>
  )

  const calendarBody = (
    <>
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded-control hover:bg-surface-emphasis transition cursor-pointer">
          <ChevronLeft className={`w-3.5 h-3.5 text-gray-600`} strokeWidth={1.5} />
        </button>
        <span className={`text-body font-medium text-text`}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded-control hover:bg-surface-emphasis transition cursor-pointer">
          <ChevronRight className={`w-3.5 h-3.5 text-gray-600`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className={`text-center text-body text-text-subtle py-0.5`}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.flat().map((date, i) => (
          <button key={i} type="button" onClick={() => handleDayClick(date)} className={getCellClass(date)}>
            {date.getDate()}
          </button>
        ))}
      </div>

      {/* Clear */}
      {value && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-center">
          <button type="button" onClick={handleClear} className="text-body text-text-subtle hover:text-gray-600 transition cursor-pointer">
            Clear
          </button>
        </div>
      )}
    </>
  )

  // ── Calendar-only mode ───────────────────────────────────────────────────
  if (calendarOnly) {
    return <div>{calendarBody}</div>
  }

  // ── Inline mode ──────────────────────────────────────────────────────────
  if (inline) {
    return (
      <div ref={containerRef} className="relative">
        <button ref={triggerRef} type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled} className={triggerClass}>
          {triggerContent}
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 min-w-[260px] max-w-[320px] bg-surface border border-border rounded-control shadow-lg p-3 z-20 animate-fade-in">
            {calendarBody}
          </div>
        )}
      </div>
    )
  }

  // ── Portal mode (default) ─────────────────────────────────────────────────
  const dropdown = mounted && open && dropdownPos ? createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 200 }}
      className={`bg-surface border border-border rounded-control shadow-lg p-2.5 text-body animate-fade-in`}
    >
      {calendarBody}
    </div>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={triggerClass}
      >
        {triggerContent}
      </button>

      {dropdown}
    </div>
  )
}
