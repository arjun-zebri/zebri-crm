'use client'

import { Pencil } from 'lucide-react'

import { PortalEvent } from './page'

/** Formats a date as "18 June 2026 · Thu" (matches the couple-modal style). */
export function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const main = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const dow = d.toLocaleDateString('en-AU', { weekday: 'short' })
  return `${main} · ${dow}`
}

/** Calculates whole days from today to a date. Null for today/past. */
export function daysUntil(dateStr: string): number | null {
  const eventDate = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 0 ? null : diffDays
}

/** Returns true if the event date is in the past. */
export function isPastEvent(dateStr: string): boolean {
  const eventDate = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return eventDate < today
}

/** Human countdown phrase for an event date: "3 days out" / "Today" / "Past". */
export function countdownPhrase(dateStr: string): string {
  if (isPastEvent(dateStr)) return 'Past'
  const days = daysUntil(dateStr)
  if (days === null) return 'Today'
  return `${days} day${days !== 1 ? 's' : ''} out`
}

/** Groups consecutive events that fall on the same date. */
function groupByDate(events: PortalEvent[]): PortalEvent[][] {
  return events.reduce<PortalEvent[][]>((acc, ev) => {
    const last = acc[acc.length - 1]
    if (last && last[0]?.date === ev.date) last.push(ev)
    else acc.push([ev])
    return acc
  }, [])
}

interface EventsListProps {
  events: PortalEvent[]
  /** Open the add-event modal (empty state). */
  onAdd: () => void
  /** Open the edit modal for a given event (row click). */
  onEdit: (event: PortalEvent) => void
}

/**
 * Vertical timeline of the couple's events — a quiet date header, an
 * emerald dot on a hairline rail, the venue, and a countdown line. Rows
 * are clickable to edit. Borderless to match the couple-modal Overview.
 */
export function EventsList({ events, onAdd, onEdit }: EventsListProps) {
  if (events.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="text-body text-text-subtle hover:text-text-muted transition cursor-pointer py-1"
      >
        No events yet — add your first event.
      </button>
    )
  }
  return (
    <div className="space-y-5">
      {groupByDate(events).map((group) => {
        const first = group[0]
        if (!first) return null
        return (
        <div key={`${first.date}-${first.id}`}>
          <p className="text-caption text-text-subtle mb-2">{formatGroupDate(first.date)}</p>
          <div className="relative">
            <div className="absolute left-[4px] top-2 bottom-2 w-px bg-border" aria-hidden />
            {group.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onEdit(event)}
                className="group relative w-full text-left pl-6 py-1.5 cursor-pointer"
              >
                <span
                  className="absolute left-0 top-2.5 w-[9px] h-[9px] rounded-full ring-2 ring-white bg-emerald-200"
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body text-text truncate">{event.venue || countdownPhrase(event.date)}</p>
                  <Pencil size={11} strokeWidth={1.5} className="shrink-0 text-text-subtle opacity-0 group-hover:opacity-60 transition" />
                </div>
                {event.venue && (
                  <p className="text-caption text-text-subtle mt-0.5">{countdownPhrase(event.date)}</p>
                )}
              </button>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}
