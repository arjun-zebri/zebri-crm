'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { TimelineItem } from './events-types'
import { CATEGORY_LABELS } from '../contacts/contacts-types'

interface EventContact {
  contact_id: string
  contact: {
    id: string
    name: string
    category: string
  }
}

interface EventTimelineModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Omit<TimelineItem, 'id' | 'event_id' | 'user_id' | 'created_at' | 'contact'>) => void
  onDelete?: () => void
  item?: TimelineItem | null
  initialTime?: string
  eventContacts: EventContact[]
  loading: boolean
}

// ─── Custom time picker ──────────────────────────────────────────────────────

function formatTimeDisplay(t: string): string {
  if (!t) return 'No time'
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// 6:00 AM → 5:45 AM (next day) — covers a full wedding day
const ALL_TIMES: string[] = []
for (let i = 0; i < 96; i++) {
  const totalMinutes = (6 * 60 + i * 15) % (24 * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  ALL_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      if (value) {
        const idx = ALL_TIMES.indexOf(value)
        if (idx >= 0) {
          // +1 for the "No time" row at top
          listRef.current.scrollTop = Math.max(0, (idx + 1) * 34 - 68)
        }
      } else {
        listRef.current.scrollTop = 0
      }
    }
  }, [open, value])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm hover:bg-gray-50 transition cursor-pointer focus:outline-none"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {formatTimeDisplay(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-2 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-y-auto py-1"
          style={{ maxHeight: '220px' }}
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-3 py-2 text-sm transition hover:bg-gray-50 ${
              !value ? 'font-medium text-gray-900' : 'text-gray-400'
            }`}
          >
            No time
          </button>
          {ALL_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange(t); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition hover:bg-gray-50 ${
                t === value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-700'
              }`}
            >
              {formatTimeDisplay(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function addMinutesToTime(t: string, mins: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 45, timeToMinutes(t) + mins))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function EventTimelineModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  item,
  initialTime = '',
  eventContacts,
  loading,
}: EventTimelineModalProps) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contactId, setContactId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const start = item?.start_time ?? initialTime ?? ''
      const end = start && item?.duration_min
        ? addMinutesToTime(start, item.duration_min)
        : start
          ? addMinutesToTime(start, 60)
          : ''
      setStartTime(start)
      setEndTime(end)
      setTitle(item?.title ?? '')
      setDescription(item?.description ?? '')
      setContactId(item?.contact_id ?? '')
      setDeleteConfirm(false)
    }
  }, [item, isOpen])

  const handleStartChange = (val: string) => {
    if (val && endTime) {
      // Keep duration constant when start changes
      const oldDuration = startTime && endTime ? timeToMinutes(endTime) - timeToMinutes(startTime) : 60
      setEndTime(addMinutesToTime(val, Math.max(15, oldDuration)))
    } else if (val && !endTime) {
      setEndTime(addMinutesToTime(val, 60))
    }
    setStartTime(val)
  }

  const handleSave = () => {
    if (!title.trim()) return
    const durationMin = startTime && endTime
      ? Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime))
      : null
    onSave({
      start_time: startTime || null,
      title: title.trim(),
      description: description.trim() || null,
      duration_min: durationMin,
      contact_id: contactId || null,
      position: item?.position ?? 1000,
    })
  }

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    onDelete?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit item' : 'Add item'}
      footer={
        <div className="flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className={`text-sm px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 ${
                  deleteConfirm
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'text-red-600 border border-red-300 hover:bg-red-50'
                }`}
              >
                {deleteConfirm ? 'Confirm delete' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">From</label>
            <TimePicker value={startTime} onChange={handleStartChange} />
          </div>
          <span className="text-sm text-gray-400 pb-2">→</span>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">To</label>
            <TimePicker value={endTime} onChange={setEndTime} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Title <span className="text-gray-400">(required)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bridal party entrance"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={7}
            placeholder="Cues, reminders, things to remember..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent resize-none"
          />
        </div>

        {eventContacts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned contact</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent bg-white"
            >
              <option value="">None</option>
              {eventContacts.map((ec) => (
                <option key={ec.contact_id} value={ec.contact_id}>
                  {ec.contact.name} —{' '}
                  {CATEGORY_LABELS[ec.contact.category as keyof typeof CATEGORY_LABELS] ||
                    ec.contact.category}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  )
}
