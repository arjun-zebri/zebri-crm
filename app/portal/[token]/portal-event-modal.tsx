'use client'

import { useState } from 'react'

import { DatePicker } from '@/components/ui/date-picker'
import { Modal } from '@/components/ui/modal'

import type { PortalEvent } from './page'

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

interface PortalEventModalProps {
  onClose: () => void
  onSave: (data: { date: string; venue: string }) => Promise<void>
  /** Event being edited, or null when adding a new one. */
  event: PortalEvent | null
  saving: boolean
}

/**
 * Add / edit modal for a couple's event from the portal. Captures date
 * (required) and venue; status is managed by the MC and left untouched.
 *
 * Mounted fresh on each open by the parent (keyed conditional render), so
 * state initialises straight from props — no re-seeding effect needed.
 */
export function PortalEventModal({ onClose, onSave, event, saving }: PortalEventModalProps) {
  const [date, setDate] = useState(event?.date ?? '')
  const [venue, setVenue] = useState(event?.venue ?? '')

  return (
    <Modal isOpen onClose={onClose} title={event ? 'Edit event' : 'Add event'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Date</label>
          <DatePicker value={date} onChange={setDate} placeholder="Select date" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Venue</label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue name"
            className={inputClass}
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ date, venue })}
            disabled={saving || !date}
            className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
