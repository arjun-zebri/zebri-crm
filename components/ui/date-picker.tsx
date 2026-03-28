'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
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
  // Monday-first offset: Mon=0, Tue=1, ..., Sun=6
  const offset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Date[] = []

  // Days from previous month
  for (let i = offset - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i))
  }
  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }
  // Days from next month to fill 42 cells
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

export function DatePicker({ value, onChange, placeholder, className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize view month/year and compute position when opening
  useEffect(() => {
    if (open) {
      const d = value ? parseYMD(value) : null
      const ref = d ?? new Date()
      setViewYear(ref.getFullYear())
      setViewMonth(ref.getMonth())

      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const top = spaceBelow < DROPDOWN_HEIGHT
          ? rect.top - DROPDOWN_HEIGHT - 4
          : rect.bottom + 4
        setDropdownPos({ top, left: rect.left })
      }
    }
  }, [open, value])

  // Outside-click and scroll handling
  useEffect(() => {
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
        setDropdownPos({ top, left: rect.left })
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
  }, [open])

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

    const base = 'w-full aspect-square flex items-center justify-center text-sm cursor-pointer transition rounded-lg'
    if (isSelected) return `${base} bg-black text-white`
    if (isToday) return `${base} bg-gray-100 text-gray-900 hover:bg-gray-200`
    if (!isCurrentMonth) return `${base} text-gray-300 hover:bg-gray-50`
    return `${base} text-gray-900 hover:bg-gray-50`
  }

  const triggerClass = `flex items-center justify-between w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition hover:bg-gray-50 cursor-pointer ${className ?? ''}`

  const dropdown = mounted && open && dropdownPos ? createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 70 }}
      className="w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3"
    >
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.flat().map((date, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleDayClick(date)}
            className={getCellClass(date)}
          >
            {date.getDate()}
          </button>
        ))}
      </div>

      {/* Clear */}
      {value && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}
    </div>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={triggerClass}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? formatDisplay(value) : (placeholder ?? 'Select date')}
        </span>
        <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
      </button>

      {dropdown}
    </div>
  )
}
