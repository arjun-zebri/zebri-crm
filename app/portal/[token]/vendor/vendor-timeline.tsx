'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock } from 'lucide-react'

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

/** Per-day dropdown for the run sheet. */
function DaySelector({
  days,
  value,
  onChange,
}: {
  days: VendorDay[]
  value: string
  onChange: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
        className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white hover:bg-gray-50 transition cursor-pointer focus:outline-none"
      >
        <span className="text-gray-900 font-medium">{formatEventDate(value)}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden py-1">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => {
                onChange(d.date)
                setOpen(false)
              }}
              className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap transition hover:bg-gray-50 cursor-pointer ${
                d.date === value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-500'
              }`}
            >
              {formatEventDate(d.date)}
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
}

/**
 * Vendor-facing run sheet. Lists the couple's events as a per-day selector
 * and shows the merged, time-ordered moments for the chosen day. Read-only.
 */
export function VendorTimeline({ events, items }: VendorTimelineProps) {
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

  return (
    <>
      {/* Header */}
      <div className="pt-8 pb-8 border-b border-gray-100">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Run Sheet</h1>
        {selectedDay && (
          <p className="text-sm text-gray-500">
            {formatEventDate(selectedDay)}
            {activeDay && activeDay.venues.length > 0
              ? ` · ${activeDay.venues.join(', ').replace(/\s*[—–]\s*/g, ', ')}`
              : ''}
          </p>
        )}
      </div>

      {days.length > 1 && selectedDay && (
        <div className="pt-6 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Day</span>
          <DaySelector days={days} value={selectedDay} onChange={setPickedDay} />
        </div>
      )}

      {/* Timeline */}
      <div className="pt-8 space-y-2">
        {dayItems.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No items yet.</p>
        ) : (
          dayItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-4 border rounded-xl px-4 py-3 ${
                item.pending_review
                  ? 'border-amber-100 bg-amber-50/30'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs w-20 shrink-0 pt-0.5">
                <Clock size={11} strokeWidth={1.5} className="text-gray-300" />
                <span
                  className={
                    item.start_time
                      ? 'text-gray-600 font-medium tabular-nums'
                      : 'text-gray-300'
                  }
                >
                  {formatTime(item.start_time)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
                {item.duration_min && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.duration_min} min</p>
                )}
              </div>
              {item.pending_review && (
                <span className="text-xs bg-amber-50 text-amber-500 border border-amber-100 rounded-full px-2 py-0.5 shrink-0">
                  Provisional
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="border-t border-gray-100 mt-12 pt-6">
        <p className="text-xs text-gray-400">
          Items marked &quot;Provisional&quot; are awaiting MC confirmation. This run sheet
          may be updated. Check back for the latest version.
        </p>
      </div>
    </>
  )
}
