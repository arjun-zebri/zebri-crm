'use client'

import { ChevronDown, Clock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'

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
 * Per-day dropdown for the run sheet. Applies branding colors for border and text.
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
  const softBg = borderColor ? `${borderColor}10` : '#F9FAFB'

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
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition cursor-pointer focus:outline-none hover:opacity-75"
        style={{
          borderColor: border,
          borderWidth: 1,
          color: text,
          backgroundColor: '#ffffff',
        }}
      >
        <span className="font-medium">
          {active ? dayLabel(active) : formatEventDate(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: text }} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 min-w-full rounded-xl shadow-lg overflow-hidden py-1"
          style={{
            borderColor: border,
            borderWidth: 1,
            backgroundColor: '#ffffff',
          }}
        >
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => {
                onChange(d.date)
                setOpen(false)
              }}
              className="block w-full text-left px-3 py-2 text-sm whitespace-nowrap transition cursor-pointer"
              style={{
                color: d.date === value ? text : '#6B7280',
                backgroundColor: d.date === value ? softBg : 'transparent',
                fontWeight: d.date === value ? 500 : 400,
              }}
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
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

/**
 * Vendor-facing run sheet. Lists the couple's events as a per-day selector
 * and shows the merged, time-ordered moments for the chosen day. Read-only.
 * Branding colors tint headings and accents.
 */
export function VendorTimeline({ events, items, branding }: VendorTimelineProps) {
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

  // Type scale from branding.
  const docTitleDefaults = roleDefaults(branding, 'docTitle')
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')
  const sectionLabelDefaults = roleDefaults(branding, 'sectionLabel')

  // Derived colors from branding; helper for softened variants.
  const hCol = branding.heading_color
  const borderCol = branding.brand_color + '20'
  const mutedCol = branding.text_color
  const softBorder = branding.border_color

  return (
    <>
      {/* Header */}
      <div className="pt-8 pb-8" style={{ borderColor: softBorder, borderBottomWidth: 1 }}>
        <h1
          className="font-semibold mb-1"
          style={{
            fontSize: `${docTitleDefaults.fontSize}px`,
            color: hCol,
            fontFamily: FONT_STACKS[docTitleDefaults.fontFamily as never],
            fontWeight: docTitleDefaults.fontWeight,
            lineHeight: docTitleDefaults.lineHeight,
          }}
        >
          Run Sheet
        </h1>
        {selectedDay && (
          <p
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: mutedCol,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            {formatEventDate(selectedDay)}
            {activeDay && activeDay.venues.length > 0
              ? ` · ${activeDay.venues.join(', ').replace(/\s*-\s*/g, ', ')}`
              : ''}
          </p>
        )}
      </div>

      {days.length > 1 && selectedDay && (
        <div className="pt-6 flex items-center gap-2">
          <span
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              fontWeight: sectionLabelDefaults.fontWeight,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              lineHeight: sectionLabelDefaults.lineHeight,
              textTransform: sectionLabelDefaults.textTransform,
              letterSpacing: sectionLabelDefaults.letterSpacing,
            }}
          >
            Day
          </span>
          <DaySelector days={days} value={selectedDay} onChange={setPickedDay} borderColor={borderCol} textColor={hCol} />
        </div>
      )}

      {/* Timeline */}
      <div className="pt-8 space-y-2">
        {dayItems.length === 0 ? (
          <p
            className="py-4"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: bodyDefaults.fontWeight,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            No items yet.
          </p>
        ) : (
          dayItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-xl px-4 py-3"
              style={{
                borderWidth: 1,
                borderColor: item.pending_review ? '#FCD34D' : softBorder,
                backgroundColor: item.pending_review ? 'rgba(254, 243, 199, 0.3)' : branding.surface_color,
                borderRadius: branding.corner_radius,
              }}
            >
              <div className="flex items-center gap-1.5 w-20 shrink-0 pt-0.5" style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
              }}>
                <Clock
                  size={11}
                  strokeWidth={1.5}
                  style={{ color: finePrintDefaults.color }}
                />
                <span
                  className="font-medium tabular-nums"
                  style={{
                    color: item.start_time ? bodyDefaults.color : finePrintDefaults.color,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  {formatTime(item.start_time)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-medium"
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: hCol,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  {item.title}
                </p>
                {item.description && (
                  <p
                    className="mt-0.5"
                    style={{
                      fontSize: `${finePrintDefaults.fontSize}px`,
                      color: mutedCol,
                      fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                      fontWeight: finePrintDefaults.fontWeight,
                      lineHeight: finePrintDefaults.lineHeight,
                    }}
                  >
                    {item.description}
                  </p>
                )}
                {item.duration_min && (
                  <p
                    className="mt-0.5"
                    style={{
                      fontSize: `${finePrintDefaults.fontSize}px`,
                      color: finePrintDefaults.color,
                      fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                      fontWeight: finePrintDefaults.fontWeight,
                      lineHeight: finePrintDefaults.lineHeight,
                    }}
                  >
                    {item.duration_min} min
                  </p>
                )}
              </div>
              {item.pending_review && (
                <span
                  className="border rounded-full px-2 py-0.5 shrink-0"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                    borderColor: '#FCD34D',
                    backgroundColor: 'rgba(254, 243, 199, 0.5)',
                    color: '#D97706',
                  }}
                >
                  Provisional
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="mt-12 pt-6" style={{ borderColor: softBorder, borderTopWidth: 1 }}>
        <p
          style={{
            fontSize: `${finePrintDefaults.fontSize}px`,
            color: finePrintDefaults.color,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            fontWeight: finePrintDefaults.fontWeight,
            lineHeight: finePrintDefaults.lineHeight,
          }}
        >
          Items marked "Provisional" are awaiting MC confirmation. This run sheet
          may be updated. Check back for the latest version.
        </p>
      </div>
    </>
  )
}
