'use client'

import { ChevronDown, Clock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface VendorTimelineItem {
  id: string
  event_id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
}

export interface VendorEvent {
  id: string
  date: string
  venue: string | null
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(time: string | null): string {
  if (!time) return 'No time'
  const [h = '0', m = '00'] = time.split(':')
  const hour = Number(h)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m.padStart(2, '0')} ${period}`
}

interface VendorDay {
  date: string
  eventIds: string[]
  venues: string[]
}

/**
 * Collapse the couple's events into distinct days, sorted chronologically.
 * A day groups every event that shares its date, so multiple ceremonies on
 * the same day land on one run sheet.
 */
function buildDays(events: VendorEvent[]): VendorDay[] {
  const byDate = new Map<string, VendorDay>()
  for (const ev of events) {
    const day = byDate.get(ev.date) ?? { date: ev.date, eventIds: [], venues: [] }
    day.eventIds.push(ev.id)
    if (ev.venue && !day.venues.includes(ev.venue)) day.venues.push(ev.venue)
    byDate.set(ev.date, day)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Soonest day that hasn't passed, else the most recent past day. */
function defaultDay(days: VendorDay[]): string | null {
  if (days.length === 0) return null
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local
  const upcoming = days.find((d) => d.date >= today)
  return (upcoming ?? days[days.length - 1])?.date ?? null
}

/** Date plus the day's venue(s), so same-day events stay distinguishable. */
function dayLabel(day: VendorDay): string {
  const date = formatEventDate(day.date)
  return day.venues.length > 0 ? `${date} · ${day.venues.join(', ')}` : date
}

/**
 * Per-day dropdown for the run sheet.
 *
 * @param days - List of distinct days with their events and venues
 * @param value - Currently selected date (YYYY-MM-DD)
 * @param onChange - Callback when a new day is selected
 * @param borderColor - Optional border colour; defaults to gray-200
 * @param textColor - Optional text colour; defaults to gray-900
 */
function DaySelector({
  days,
  value,
  onChange,
  borderColor,
  textColor,
}: {
  days: VendorDay[]
  value: string
  onChange: (date: string) => void
  borderColor?: string
  textColor?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const active = days.find((d) => d.date === value) ?? null

  // Default to the original gray palette when colours are not provided.
  const border = borderColor ?? '#E5E7EB'
  const text = textColor ?? '#111827'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm bg-white hover:bg-gray-50 transition cursor-pointer focus:outline-none"
        style={{ borderColor: border, borderWidth: 1, color: text }}
      >
        <span className="font-medium">
          {active ? dayLabel(active) : formatEventDate(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-full bg-white rounded-xl shadow-lg overflow-hidden py-1" style={{ borderColor: border, borderWidth: 1 }}>
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => {
                onChange(d.date)
                setOpen(false)
              }}
              className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap transition hover:bg-gray-50 cursor-pointer ${
                d.date === value ? 'bg-gray-50 font-medium' : ''
              }`}
              style={{ color: d.date === value ? text : '#6B7280' }}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface VendorTimelineProps {
  events: VendorEvent[]
  items: VendorTimelineItem[]
  /**
   * Optional colour for headings. When not provided, defaults to gray-900.
   * Applied to the "Run Sheet" title, day label, and item titles.
   */
  headingColor?: string
  /**
   * Optional accent colour for the day selector border and active states.
   * When not provided, defaults to gray-200 for borders and gray-900 for text.
   */
  accentColor?: string
}

/**
 * Vendor-facing run sheet. Lists the couple's events as a per-day selector
 * and shows the merged, time-ordered moments for the chosen day. Read-only.
 * Optional branding colors tint headings and accents; when not provided,
 * the component renders identically to the original unbranded layout.
 */
export function VendorTimeline({ events, items, headingColor, accentColor }: VendorTimelineProps) {
  const days = useMemo(() => buildDays(events), [events])
  const [pickedDay, setPickedDay] = useState<string | null>(null)

  // Derive the day in view from render: the vendor's pick if still valid,
  // else the soonest upcoming day.
  const selectedDay =
    pickedDay && days.some((d) => d.date === pickedDay)
      ? pickedDay
      : defaultDay(days)

  const activeDay = days.find((d) => d.date === selectedDay) ?? null
  const dayEventIds = new Set(activeDay?.eventIds ?? [])
  const dayItems = items.filter((i) => dayEventIds.has(i.event_id))

  // Derived colors — default to grays so unbranded output is byte-identical.
  const hCol = headingColor ?? '#111827'
  const borderCol = accentColor ? accentColor + '20' : '#F3F4F6'
  const mutedCol = '#6B7280'

  return (
    <>
      {/* Header */}
      <div className="pt-8 pb-8" style={{ borderColor: '#F3F4F6', borderBottomWidth: 1 }}>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: hCol }}>Run Sheet</h1>
        {selectedDay && (
          <p className="text-sm" style={{ color: mutedCol }}>
            {formatEventDate(selectedDay)}
            {activeDay && activeDay.venues.length > 0
              ? ` · ${activeDay.venues.join(', ').replace(/\s*-\s*/g, ', ')}`
              : ''}
          </p>
        )}
      </div>

      {days.length > 1 && selectedDay && (
        <div className="pt-6 flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Day</span>
          <DaySelector days={days} value={selectedDay} onChange={setPickedDay} borderColor={borderCol} textColor={hCol} />
        </div>
      )}

      {/* Timeline */}
      <div className="pt-8 space-y-2">
        {dayItems.length === 0 ? (
          <p className="text-sm py-4" style={{ color: '#9CA3AF' }}>No items yet.</p>
        ) : (
          dayItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-xl px-4 py-3"
              style={{
                borderWidth: 1,
                borderColor: item.pending_review ? '#FCD34D' : '#F3F4F6',
                backgroundColor: item.pending_review ? 'rgba(254, 243, 199, 0.3)' : '#ffffff',
              }}
            >
              <div className="flex items-center gap-1.5 text-xs w-20 shrink-0 pt-0.5">
                <Clock size={11} strokeWidth={1.5} style={{ color: '#D1D5DB' }} />
                <span
                  className="font-medium tabular-nums"
                  style={{
                    color: item.start_time ? '#4B5563' : '#D1D5DB',
                  }}
                >
                  {formatTime(item.start_time)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: hCol }}>{item.title}</p>
                {item.description && (
                  <p className="text-xs mt-0.5" style={{ color: mutedCol }}>{item.description}</p>
                )}
                {item.duration_min && (
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{item.duration_min} min</p>
                )}
              </div>
              {item.pending_review && (
                <span className="text-xs border rounded-full px-2 py-0.5 shrink-0" style={{ borderColor: '#FCD34D', backgroundColor: 'rgba(254, 243, 199, 0.5)', color: '#D97706' }}>
                  Provisional
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="mt-12 pt-6" style={{ borderColor: '#F3F4F6', borderTopWidth: 1 }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          Items marked "Provisional" are awaiting MC confirmation. This run sheet
          may be updated. Check back for the latest version.
        </p>
      </div>
    </>
  )
}
