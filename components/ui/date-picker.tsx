'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  /** Trigger visual style. `outlined` is the default boxed input
   *  (rounded-control border, used by builder modals). `underline` is the
   *  flat single-rule style used in form modals that follow the
   *  couple-modal vocabulary (transparent, bottom border, no ring).
   *  `meta` matches the builder meta-row controls (couple picker,
   *  terms picker): token chrome, compact padding, no focus ring. */
  variant?: 'outlined' | 'underline' | 'meta'
  /** Month/year to open the calendar to when no value is set.
   *  YYYY-MM-DD. Falls back to today. Used by the event modal to
   *  scroll to the couple's existing event date when adding a second
   *  event on the same day. */
  defaultViewDate?: string
  /** Trigger and calendar scale. `md` (default) is the historic size.
   *  `sm` matches `Input size="sm"` — 32px tall, 12px text, control
   *  radius — and shrinks the calendar to suit, so a date field sitting
   *  in a compact form does not open a calendar built for a larger one. */
  size?: 'sm' | 'md'
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
 * Width bounds for the calendar, per size. The day cells are
 * `aspect-square`, so width drives height: matched to a full-width date
 * field the calendar inflates into 60px tiles. The floor keeps seven
 * columns legible under a narrow trigger.
 */
const DROPDOWN_WIDTH = {
  sm: { min: 220, max: 264 },
  md: { min: 260, max: 320 },
} as const

/** Calendar width for a trigger of `triggerWidth`, clamped to its size. */
function calendarWidth(size: 'sm' | 'md', triggerWidth: number): number {
  const { min, max } = DROPDOWN_WIDTH[size]
  return Math.min(max, Math.max(min, triggerWidth))
}

export function DatePicker({ value, onChange, placeholder, className, inline, calendarOnly, disabled, iconPosition = 'right', displayPrefix, variant = 'outlined', defaultViewDate, size = 'md' }: DatePickerProps) {
  const isSmall = size === 'sm'
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
        // input it belongs to, within the bounds for this size.
        const width = calendarWidth(size, rect.width)
        const left = rect.left + width > window.innerWidth - 8
          ? Math.max(8, rect.right - width)
          : rect.left

        setDropdownPos({ top, left, width })
      }
    }
  }, [open, value, inline, size])

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const inContainer = containerRef.current?.contains(e.target as Node)
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
      const inTrigger = containerRef.current?.contains(e.target as Node)
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
        const width = calendarWidth(size, rect.width)
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
  }, [open, inline, size])

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

    const base = `w-full aspect-square flex items-center justify-center ${
      isSmall ? 'text-caption rounded-control' : 'text-sm rounded-control'
    } cursor-pointer transition`
    if (isSelected) return `${base} bg-black text-white`
    if (isToday) return `${base} bg-surface-emphasis text-text hover:bg-gray-200`
    if (!isCurrentMonth) return `${base} text-gray-300 hover:bg-gray-50`
    return `${base} text-text hover:bg-gray-50`
  }

  const triggerLayout =
    iconPosition === 'left' ? 'justify-start gap-2' : 'justify-between'
  const isUnderline = variant === 'underline'
  const isMeta = variant === 'meta'
  // Three visual treatments - boxed/outlined for legacy builder use,
  // flat-underline for the form modals that share the couple-modal
  // vocabulary (Couple, Event), and `meta` for the builder meta rows
  // where the trigger must read as a sibling of the couple/terms
  // pickers (same token chrome, no focus ring). Underline mode
  // intentionally drops the green focus ring; the form's other inputs
  // use the same calm `focus:border-gray-400` underline state.
  const baseChrome = isMeta
    ? 'border border-border rounded-control px-2.5 py-1.5 bg-surface'
    : isUnderline
    ? 'border-0 border-b rounded-none px-0 py-2 bg-transparent'
    : isSmall
    ? // Deliberately the Input `sm` geometry — 32px tall, control
      // radius — so a date field reads as a sibling of the text fields
      // beside it rather than a slightly rounder, slightly taller one.
      'border rounded-control px-2.5 h-8 bg-surface'
    : 'border rounded-control px-3 py-2'
  const stateChrome = disabled
    ? isMeta
      ? 'opacity-70 cursor-not-allowed'
      : isUnderline
      ? 'border-gray-100 text-text-subtle cursor-not-allowed'
      : 'border-gray-100 bg-gray-50 text-text-subtle cursor-not-allowed'
    : isMeta
    ? 'hover:bg-surface-muted'
    : isUnderline
    ? open
      ? 'border-gray-400'
      : 'border-border hover:border-border-strong focus:border-gray-400'
    : isSmall
    ? // Same focus treatment as `Input`: the border darkens, no ring.
      // The outlined default's green ring is a leftover from the builder
      // modals and reads as an alert next to neutral token chrome.
      open
      ? 'border-border-strong'
      : 'border-border hover:bg-surface-muted focus-visible:border-brand-fg'
    : open && inline
    ? 'border-green-300 ring-2 ring-green-100 bg-surface hover:bg-surface'
    : 'border-border hover:bg-gray-50 focus:border-green-300 focus:ring-2 focus:ring-green-100'
  const triggerClass = `flex items-center ${
    isMeta ? 'justify-start gap-1.5' : triggerLayout
  } w-full ${isSmall ? 'text-caption' : 'text-sm'} focus:outline-none ${
    isMeta ? 'transition-colors' : 'transition'
  } cursor-pointer ${baseChrome} ${stateChrome} ${className ?? ''}`

  const calendarIcon = isMeta || isSmall ? (
    <CalendarDays className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" strokeWidth={1.5} />
  ) : (
    <CalendarDays className="w-4 h-4 text-text-subtle flex-shrink-0" strokeWidth={1.5} />
  )
  const displayedValue = value
    ? displayPrefix
      ? `${displayPrefix} ${formatDisplay(value)}`
      : formatDisplay(value)
    : (placeholder ?? 'Select date')
  const valueClass = isMeta
    ? value
      ? 'text-text truncate'
      : 'text-text-subtle truncate'
    : value
    ? 'text-text'
    : 'text-text-subtle'
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
          <ChevronLeft className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-gray-600`} strokeWidth={1.5} />
        </button>
        <span className={`${isSmall ? 'text-caption' : 'text-sm'} font-medium text-text`}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded-control hover:bg-surface-emphasis transition cursor-pointer">
          <ChevronRight className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-gray-600`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className={`text-center text-caption text-text-subtle ${isSmall ? 'py-0.5' : 'py-1'}`}>{d}</div>
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
          <button type="button" onClick={handleClear} className="text-xs text-text-subtle hover:text-gray-600 transition cursor-pointer">
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
      className={`bg-surface border border-border rounded-control shadow-lg ${isSmall ? 'p-2.5' : 'p-3'} animate-fade-in`}
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
