'use client'

import { ChevronDown, Clock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import type { TextStyle } from '@/app/(dashboard)/branding/blocks/types'
import { isChromePress } from '@/components/ui/use-overlay'
import { getRgb } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { applyCase, cssTextTransform } from '@/lib/branding/text-case'
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !isChromePress(e.target)) {
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
        className="flex items-center justify-between gap-2 rounded-control px-3 py-2 text-sm transition cursor-pointer focus:outline-none hover:opacity-75"
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
          className="absolute z-50 mt-1 min-w-full rounded-control shadow-lg overflow-hidden py-1"
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
  /**
   * Print mode: render every day in sequence with no day picker. The picker
   * is interactive chrome that has no meaning on paper, and a single day
   * would drop the rest of a multi-day event from the PDF.
   */
  static?: boolean
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
  /**
   * Optional run-sheet-scoped typography overrides, from the
   * `vendorTimelineBody` branding block. `title` styles the `<h1>`, `subtitle`
   * the date / venue line, `body` the per-item title, and `note` the per-item
   * description. Each unset field falls back to the value the component
   * currently hard-codes, so a run sheet with no overrides is byte-identical.
   */
  styles?: {
    title?: TextStyle | undefined
    subtitle?: TextStyle | undefined
    body?: TextStyle | undefined
    note?: TextStyle | undefined
  }
}

/**
 * Vendor-facing run sheet. Lists the couple's events as a per-day selector
 * and shows the merged, time-ordered moments for the chosen day. Read-only.
 * Branding colors tint headings and accents.
 */
/**
 * Provisional (pending review) styling. Pending is a status, not a brand
 * state, so it derives from the fixed warning colour rather than a copied
 * hex. Tints composite through getRgb because a hex inside rgba() is invalid
 * CSS and the declaration would be dropped silently.
 */
const PROVISIONAL = (() => {
  const rgb = getRgb(STATUS_COLORS.warning)
  const tint = (alpha: number) =>
    rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : 'transparent'
  return {
    border: tint(0.45),
    rowBackground: tint(0.08),
    badgeBackground: tint(0.14),
    text: STATUS_COLORS.warning,
  }
})()

export function VendorTimeline({ events, items, branding, styles, static: isStatic }: VendorTimelineProps) {
  const days = useMemo(() => buildDays(events), [events])
  const [pickedDay, setPickedDay] = useState<string | null>(null)

  if (isStatic) {
    return (
      <>
        {days.map((day) => (
          <VendorTimelineDay
            key={day.date}
            day={day}
            items={items.filter((i) => day.eventIds.includes(i.event_id))}
            branding={branding}
            {...(styles ? { styles } : {})}
          />
        ))}
      </>
    )
  }

  // Derive the day in view from render: the vendor's pick if still valid,
  // else the soonest upcoming day.
  const selectedDay =
    pickedDay && days.some((d) => d.date === pickedDay)
      ? pickedDay
      : defaultDay(days)

  const activeDay = days.find((d) => d.date === selectedDay) ?? null
  // Read by the day-picker row below; the per-day render derives its own.
  const sectionLabelDefaults = roleDefaults(branding, 'sectionLabel')
  const hCol = branding.heading_color
  const borderCol = branding.brand_color + '20'
  const dayItems = activeDay ? items.filter((i) => activeDay.eventIds.includes(i.event_id)) : []
  return (
    <>
      {activeDay ? (
        <VendorTimelineDay
          day={activeDay}
          items={dayItems}
          branding={branding}
          picker={
            days.length > 1 && selectedDay ? (
        <div className="pt-6 flex items-center gap-2">
          <span
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              fontWeight: sectionLabelDefaults.fontWeight,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              lineHeight: sectionLabelDefaults.lineHeight,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
              letterSpacing: sectionLabelDefaults.letterSpacing,
            }}
          >
            {applyCase('Day', sectionLabelDefaults.textTransform)}
          </span>
          <DaySelector days={days} value={selectedDay} onChange={setPickedDay} borderColor={borderCol} textColor={hCol} />
        </div>
            ) : null
          }
          {...(styles ? { styles } : {})}
        />
      ) : null}
    </>
  )
}

/**
 * One day of the run sheet: its header (date, venues) and its items.
 *
 * Pure, so it serves both the interactive page (one day at a time, chosen
 * with the picker) and print (every day in sequence). Extracted from the
 * interactive render rather than duplicated, so the two cannot drift.
 */
function VendorTimelineDay({
  day,
  items,
  branding,
  styles,
  picker,
}: {
  day: VendorDay
  items: VendorTimelineItem[]
  branding: PublicBranding
  styles?: VendorTimelineProps['styles']
  /** The interactive day picker, slotted between header and items. Absent in print. */
  picker?: ReactNode
}) {

  // Type scale from branding.
  const docTitleDefaults = roleDefaults(branding, 'docTitle')
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  // Derived colors from branding; helper for softened variants.
  const hCol = branding.heading_color
  const mutedCol = branding.text_color
  const softBorder = branding.border_color

  // Run-sheet-scoped typography. Each element resolves its block override over
  // defaults built from the SAME values it currently hard-codes: the role's
  // font / size / weight / line-height, its current manual colour (hCol /
  // mutedCol), and `letterSpacing: 0` + `textTransform: 'none'` — the neutral
  // values today's inline styles already render, since they set neither. So
  // with no override each `resolveTextStyle` yields today's style exactly (the
  // three forced fields are visual no-ops), keeping legacy run sheets identical.
  const titleCss = resolveTextStyle(styles?.title, {
    ...docTitleDefaults,
    color: hCol,
    letterSpacing: 0,
    textTransform: 'none',
  })
  const subtitleCss = resolveTextStyle(styles?.subtitle, {
    ...finePrintDefaults,
    color: mutedCol,
    letterSpacing: 0,
    textTransform: 'none',
  })
  // The item title and its description are independent targets: the title uses
  // the `body` override over the body role; the description uses the separate
  // `note` override over the finePrint role. An unset override on either
  // reproduces its distinct historical style exactly.
  const itemTitleCss = resolveTextStyle(styles?.body, {
    ...bodyDefaults,
    color: hCol,
    letterSpacing: 0,
    textTransform: 'none',
  })
  const itemDescCss = resolveTextStyle(styles?.note, {
    ...finePrintDefaults,
    color: mutedCol,
    letterSpacing: 0,
    textTransform: 'none',
  })

  return (
    <>
      {/* Header */}
      <div className="pt-8 pb-8" style={{ borderColor: softBorder, borderBottomWidth: 1 }}>
        <h1 data-subtarget="title" className="font-semibold mb-1" style={titleCss}>
          Run Sheet
        </h1>
        {day.date && (
          <p data-subtarget="subtitle" style={subtitleCss}>
            {formatEventDate(day.date)}
            {day.venues.length > 0
              ? ` · ${day.venues.join(', ').replace(/\s*-\s*/g, ', ')}`
              : ''}
          </p>
        )}
      </div>

      {picker}

      {/* Timeline */}
      <div className="pt-8 space-y-2">
        {items.length === 0 ? (
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
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-control px-4 py-3"
              style={{
                borderWidth: 1,
                borderColor: item.pending_review ? PROVISIONAL.border : softBorder,
                backgroundColor: item.pending_review ? PROVISIONAL.rowBackground : branding.surface_color,
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
                <p data-subtarget="body" className="font-medium" style={itemTitleCss}>
                  {item.title}
                </p>
                {item.description && (
                  <p data-subtarget="note" className="mt-0.5" style={itemDescCss}>
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
                  className="border rounded-pill px-2 py-0.5 shrink-0"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                    borderColor: PROVISIONAL.border,
                    backgroundColor: PROVISIONAL.badgeBackground,
                    color: PROVISIONAL.text,
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
