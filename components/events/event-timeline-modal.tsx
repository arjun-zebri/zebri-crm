'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { TimelineItem } from '@/types/event'

interface EventTimelineModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Omit<TimelineItem, 'id' | 'event_id' | 'user_id' | 'created_at' | 'contact'>) => void
  onDelete?: () => void
  item?: TimelineItem | null
  initialTime?: string
  loading: boolean
  showStatus?: boolean
}

// ─── Custom time picker ──────────────────────────────────────────────────────

function formatTimeDisplay(t: string): string {
  if (!t) return 'No time'
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// 6:00 AM → 5:45 AM (next day) - covers a full wedding day
const ALL_TIMES: string[] = []
for (let i = 0; i < 96; i++) {
  const totalMinutes = (6 * 60 + i * 15) % (24 * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  ALL_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}

export function TimePicker({
  value,
  onChange,
  variant = 'box',
}: {
  value: string
  onChange: (v: string) => void
  /** `box` is the standalone bordered pill (template manager rows).
   *  `underline` matches the couple/event modal field vocabulary so the
   *  three forms read as one product. */
  variant?: 'box' | 'underline'
}) {
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
        className={`flex items-center justify-between w-36 text-sm transition cursor-pointer focus:outline-none ${
          variant === 'underline'
            ? 'border-0 border-b border-gray-200 bg-transparent px-0 py-2 hover:border-gray-400 focus:border-gray-400'
            : 'border border-gray-200 rounded-control px-3 py-2 hover:bg-gray-50'
        }`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {formatTimeDisplay(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-2 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-36 bg-white border border-gray-200 rounded-control shadow-lg overflow-y-auto py-1"
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

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function addMinutesToTime(t: string, mins: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 45, timeToMinutes(t) + mins))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Modal ───────────────────────────────────────────────────────────────────

// Underline field + label vocabulary shared with the couple and event
// modals (`border-b`, transparent background, calm focus). All three open
// off the couple profile, so they should read as one product.
const inputClass =
  'w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition'
const labelClass = 'block text-sm text-gray-600 mb-1'

export function EventTimelineModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  item,
  initialTime = '',
  loading,
  showStatus,
}: EventTimelineModalProps) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contactId, setContactId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [statusSelection, setStatusSelection] = useState<'timeline' | 'unscheduled' | 'review'>('timeline')

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
      // A brand-new item added from the grid has no `item` but does carry an
      // `initialTime`, so it's a scheduled (timeline) item. Without folding
      // `initialTime` in here it defaulted to 'unscheduled', which applied
      // `pointer-events-none` to the From/To row and froze the time pickers.
      setStatusSelection(item?.pending_review ? 'review' : (item?.start_time || initialTime) ? 'timeline' : 'unscheduled')
    }
  }, [item, isOpen, initialTime])

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

  const handleStatusChange = (s: 'timeline' | 'unscheduled' | 'review') => {
    setStatusSelection(s)
    if (s === 'unscheduled') {
      setStartTime('')
      setEndTime('')
    }
  }

  const handleSave = () => {
    if (!title.trim()) return
    // The status toggle (and its 'unscheduled' lock) only exists for an
    // existing `item`. A new item is always driven straight off the From/To
    // pickers, so the times must never be discarded here.
    const isUnscheduledStatus = showStatus && !!item && statusSelection === 'unscheduled'
    const effectiveStart = isUnscheduledStatus ? '' : startTime
    const effectiveEnd = isUnscheduledStatus ? '' : endTime
    const durationMin = effectiveStart && effectiveEnd
      ? Math.max(15, timeToMinutes(effectiveEnd) - timeToMinutes(effectiveStart))
      : null
    onSave({
      start_time: effectiveStart || null,
      title: title.trim(),
      description: description.trim() || null,
      duration_min: durationMin,
      contact_id: contactId || null,
      position: item?.position ?? 1000,
      ...(showStatus ? { pending_review: statusSelection === 'review' } : {}),
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
                className={`text-xs px-3 py-1.5 rounded-control transition cursor-pointer disabled:opacity-50 ${
                  deleteConfirm
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
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
              className="text-xs px-3 py-1.5 rounded-control bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="text-xs px-3 py-1.5 rounded-control bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {showStatus && item && (
          <div>
            <label className={labelClass}>Status</label>
            <div className="flex border border-gray-200 rounded-control overflow-hidden">
              {(['timeline', 'unscheduled', 'review'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className={`flex-1 text-xs py-2 transition cursor-pointer ${
                    statusSelection === s
                      ? s === 'review'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'timeline' ? 'Timeline' : s === 'unscheduled' ? 'Unscheduled' : 'To Review'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`flex items-end gap-3 ${showStatus && item && statusSelection === 'unscheduled' ? 'opacity-40 pointer-events-none' : ''}`}>
          <div>
            <label className={labelClass}>From</label>
            <TimePicker value={startTime} onChange={handleStartChange} variant="underline" />
          </div>
          <span className="text-sm text-gray-400 pb-2">→</span>
          <div>
            <label className={labelClass}>To</label>
            <TimePicker value={endTime} onChange={setEndTime} variant="underline" />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bridal party entrance"
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={7}
            placeholder="Cues, reminders, things to remember..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>
    </Modal>
  )
}
