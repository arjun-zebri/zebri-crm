'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { Modal } from '@/components/ui/modal'
import { Couple, CoupleStatus, STATUSES, STATUS_LABELS } from './couples-types'

interface CoupleModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (couple: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string }) => void
  onDelete: (id: string) => void
  couple?: Couple
  defaultStatus?: CoupleStatus
  loading: boolean
}

export function CoupleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  couple,
  defaultStatus,
  loading,
}: CoupleModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [venue, setVenue] = useState('')
  const [status, setStatus] = useState<string>('new')
  const [notes, setNotes] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const deleteTimeoutRef = useState<NodeJS.Timeout | null>(null)[1]

  useEffect(() => {
    if (couple) {
      setName(couple.name)
      setEmail(couple.email)
      setPhone(couple.phone)
      setEventDate(couple.event_date || '')
      setVenue(couple.venue)
      setStatus(couple.status)
      setNotes(couple.notes)
    } else {
      resetForm()
      if (defaultStatus) {
        setStatus(defaultStatus)
      }
    }
    setDeleteConfirm(false)
  }, [couple, isOpen])

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setEventDate('')
    setVenue('')
    setStatus('new')
    setNotes('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      id: couple?.id,
      name,
      email,
      phone,
      event_date: eventDate || null,
      venue,
      status: status as any,
      notes,
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

    if (couple) {
      onDelete(couple.id)
    }
  }

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  const selectedLabel = STATUS_LABELS[status as keyof typeof STATUS_LABELS]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={couple ? 'Edit Couple' : 'Add Couple'}
      footer={
        <div className="flex items-center justify-between">
          {couple && (
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
              disabled={loading || !name.trim()}
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Couple's name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+61 400 000 000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className={inputClass}
              placeholder="Venue name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${inputClass} flex items-center justify-between text-left`}
                >
                  <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedLabel || 'Select status'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
                  align="start"
                >
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatus(s)
                        setStatusOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        status === s ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
            placeholder="Any additional notes..."
            rows={3}
          />
        </div>
      </form>
    </Modal>
  )
}
