/**
 * Legacy slot picker for the manage booking page.
 *
 * Uses the old fortnight navigation and 2-column grid layout.
 * Kept separate from the new calendar-based public booking picker.
 *
 * @module app/book/manage/[manage_token]/legacy-slot-picker
 */

'use client'

import { useMemo } from 'react'

import { Button } from '@/components/ui/button'

import type { Slot } from './use-manage-booking'

export interface LegacySlotPickerProps {
  state: 'loading' | 'ready' | 'error'
  slots: Slot[]
  timezone: string
  currentFrom: string
  currentTo: string
  onSelectSlot: (slot: Slot) => void
  onLoadPreviousFortnight: () => void
  onLoadNextFortnight: () => void
}

function formatSlotTime(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
    timeZoneName: 'short',
  })
  return formatter.format(date)
}

function formatDayHeader(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  })
  return formatter.format(date)
}

function getLocalDay(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  })
  return formatter.format(date)
}

function groupSlotsByDay(
  slots: Slot[],
  timezone: string,
): Array<{ day: string; dayHeader: string; slots: Slot[] }> {
  const groups = new Map<string, Slot[]>()
  for (const slot of slots) {
    const day = getLocalDay(slot.start, timezone)
    if (!groups.has(day)) {
      groups.set(day, [])
    }
    groups.get(day)!.push(slot)
  }
  return Array.from(groups.entries()).map(([day, daySlots]) => ({
    day,
    dayHeader: formatDayHeader(day + 'T00:00:00Z', timezone),
    slots: daySlots,
  }))
}

/**
 * Renders slots in the legacy grid format for manage bookings.
 */
export function LegacySlotPicker({
  state,
  slots,
  timezone,
  onSelectSlot,
  onLoadPreviousFortnight,
  onLoadNextFortnight,
}: LegacySlotPickerProps) {
  const groupedSlots = useMemo(() => groupSlotsByDay(slots, timezone), [slots, timezone])

  if (state === 'loading') {
    return <p className="text-sm text-text-muted py-10 text-center">Loading available times...</p>
  }

  if (state === 'error') {
    return (
      <p className="text-sm text-danger py-10 text-center">
        Availability is temporarily unavailable, please try again shortly.
      </p>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted text-center">
          No times available, try the next two weeks.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onLoadPreviousFortnight} className="text-sm">
            Previous
          </Button>
          <Button variant="secondary" onClick={onLoadNextFortnight} className="text-sm">
            Next
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted text-center">Times shown in your local time</p>

      <div className="space-y-6">
        {groupedSlots.map((group) => (
          <div key={group.day}>
            <h3 className="text-sm font-semibold text-text mb-3">{group.dayHeader}</h3>
            <div className="grid grid-cols-2 gap-2">
              {group.slots.map((slot) => (
                <button
                  key={slot.start}
                  onClick={() => onSelectSlot(slot)}
                  className="px-3 py-2 rounded-control border border-border text-sm text-text hover:bg-surface-emphasis transition-colors cursor-pointer"
                >
                  {formatSlotTime(slot.start, timezone)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-3 pt-4">
        <Button variant="secondary" onClick={onLoadPreviousFortnight} className="text-sm">
          Previous
        </Button>
        <Button variant="secondary" onClick={onLoadNextFortnight} className="text-sm">
          Next
        </Button>
      </div>
    </div>
  )
}
