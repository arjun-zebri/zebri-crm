'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { Modal } from '@/components/ui/modal'
import { Event, EventStatus, STATUS_LABELS } from '../events/events-types'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string }) => void
  event?: Event
  coupleId: string
  loading: boolean
}

const EVENT_STATUSES: EventStatus[] = ['upcoming', 'completed', 'cancelled']

export function EventModal({
  isOpen,
  onClose,
  onSave,
  event,
  coupleId,
  loading,
}: EventModalProps) {
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [status, setStatus] = useState<EventStatus>('upcoming')
  const [notes, setNotes] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (event) {
      setDate(event.date)
      setVenue(event.venue)
      setStatus(event.status)
      setNotes(event.timeline_notes)
    } else {
      resetForm()
    }
    setDeleteConfirm(false)
  }, [event, isOpen])

  const resetForm = () => {
    setDate('')
    setVenue('')
    setStatus('upcoming')
    setNotes('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date.trim()) return

    onSave({
      id: event?.id,
      couple_id: coupleId,
      date,
      venue,
      status,
      timeline_notes: notes,
    })

    resetForm()
  }

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      const timeout = setTimeout(() => {
        setDeleteConfirm(false)
      }, 3000)
      return
    }

    // This won't be called from here - delete is handled in couple-events.tsx
  }

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? 'Edit Event' : 'Add Event'}
      footer={
        <div className="flex items-center justify-between">
          {event && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className={`text-sm px-4 py-2 rounded-lg transition ${
                deleteConfirm
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              {deleteConfirm ? 'Click again to confirm' : 'Delete'}
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !date.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Venue - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g., Grand Hotel Ballroom"
              className={inputClass}
            />
          </div>

          {/* Status - 1 col */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={inputClass + ' flex items-center justify-between'}
                >
                  {STATUS_LABELS[status]}
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className="z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-1"
                side="bottom"
                align="start"
              >
                {EVENT_STATUSES.map((stat) => (
                  <button
                    key={stat}
                    type="button"
                    onClick={() => {
                      setStatus(stat)
                      setStatusOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition ${
                      status === stat
                        ? 'bg-green-50 text-green-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {STATUS_LABELS[stat]}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Root>
          </div>

          {/* Notes - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Timeline, ceremony details, vendor notes..."
              rows={6}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
