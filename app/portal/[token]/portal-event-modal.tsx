'use client'

import { useState } from 'react'

import { BusyLabel } from '@/components/ui/busy-label'
import { DatePicker } from '@/components/ui/date-picker'
import { Modal } from '@/components/ui/modal'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'

import type { PortalEvent } from './page'

interface PortalEventModalProps {
  onClose: () => void
  onSave: (data: { date: string; venue: string }) => Promise<void>
  /** Event being edited, or null when adding a new one. */
  event: PortalEvent | null
  saving: boolean
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

/**
 * Add / edit modal for a couple's event from the portal. Captures date
 * (required) and venue; status is managed by the MC and left untouched.
 *
 * Mounted fresh on each open by the parent (keyed conditional render), so
 * state initialises straight from props - no re-seeding effect needed.
 */
export function PortalEventModal({ onClose, onSave, event, saving, branding }: PortalEventModalProps) {
  const [date, setDate] = useState(event?.date ?? '')
  const [venue, setVenue] = useState(event?.venue ?? '')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')
  const bodyDefaults = roleDefaults(branding, 'body')

  return (
    <Modal isOpen onClose={onClose} title={event ? 'Edit event' : 'Add event'} size="md">
      <div className="space-y-4">
        <div>
          <label
            className="block mb-1.5"
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            Date
          </label>
          <DatePicker value={date} onChange={setDate} placeholder="Select date" />
        </div>
        <div>
          <label
            className="block mb-1"
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            Venue
          </label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue name"
            style={{
              width: '100%',
              borderRadius: `${branding.corner_radius}px`,
              padding: '0.5rem 0.75rem',
              fontSize: `${bodyDefaults.fontSize}px`,
              color: bodyDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: bodyDefaults.fontWeight,
              lineHeight: bodyDefaults.lineHeight,
              border: `1px solid ${branding.border_color}`,
              outline: 'none',
            }}
            className="transition hover:opacity-80 focus:opacity-100"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: `1px solid ${branding.border_color}` }}>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 transition cursor-pointer hover:opacity-75"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: bodyDefaults.fontWeight,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ date, venue })}
            disabled={saving || !date}
            className="rounded-control px-3 py-1.5 transition cursor-pointer disabled:opacity-50 hover:opacity-90"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: 'white',
              backgroundColor: branding.brand_color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: bodyDefaults.fontWeight,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            <BusyLabel busy={saving}>Save</BusyLabel>
          </button>
        </div>
      </div>
    </Modal>
  )
}
