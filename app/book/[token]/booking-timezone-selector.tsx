/**
 * Timezone control for the public booking page.
 *
 * Shows the zone the times are being rendered in and lets the booker change
 * it. Zebri cannot know where a couple is, so it does what Calendly does:
 * guess from the browser, state the guess where the times are, and make
 * correcting it one click. It never infers the booker's zone from the MC's.
 *
 * @module app/book/[token]/booking-timezone-selector
 */

'use client'

import { ChevronDown, Globe } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TimezonePickerModal } from '@/components/scheduling/timezone-picker-modal'
import { timezoneLongLabel } from '@/lib/scheduling/timezone-options'

export interface BookingTimezoneSelectorProps {
  /** The zone times are currently rendered in. */
  timezone: string
  /** Called with the booker's chosen zone. */
  onTimezoneChange: (timezone: string) => void
}

/** Zone label plus a button that opens the searchable picker. */
export function BookingTimezoneSelector({
  timezone,
  onTimezoneChange,
}: BookingTimezoneSelectorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const label = useMemo(() => timezoneLongLabel(timezone), [timezone])

  if (!timezone) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex items-center gap-2 text-body text-text-muted hover:text-text transition-colors"
      >
        <Globe size={16} strokeWidth={1.5} />
        <span>{label}</span>
        <ChevronDown size={16} strokeWidth={1.5} />
      </button>

      <TimezonePickerModal
        isOpen={pickerOpen}
        value={timezone}
        onSelect={onTimezoneChange}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
