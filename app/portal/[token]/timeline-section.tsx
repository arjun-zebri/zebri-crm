'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createBrowserClient } from '@supabase/ssr'
import { Modal } from '@/components/ui/modal'
import type { PortalTimelineItem } from './page'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

function formatTimeDisplay(t: string): string {
  if (!t) return 'No time'
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

const ALL_TIMES: string[] = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    ALL_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
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
        if (idx >= 0) listRef.current.scrollTop = Math.max(0, (idx + 1) * 34 - 68)
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

interface ItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { start_time: string | null; title: string; description: string | null; duration_min: number | null }) => void
  onDelete?: () => void
  item?: PortalTimelineItem | null
  loading: boolean
}

function ItemModal({ isOpen, onClose, onSave, onDelete, item, loading }: ItemModalProps) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const start = item?.start_time ?? ''
      const end = start && item?.duration_min
        ? addMinutesToTime(start, item.duration_min)
        : start ? addMinutesToTime(start, 60) : ''
      setStartTime(start)
      setEndTime(end)
      setTitle(item?.title ?? '')
      setDescription(item?.description ?? '')
      setDeleteConfirm(false)
    }
  }, [item, isOpen])

  const handleStartChange = (val: string) => {
    if (val && endTime) {
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
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit moment' : 'Add moment'}
      footer={
        <div className="flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                onClick={() => { if (!deleteConfirm) { setDeleteConfirm(true); return } onDelete() }}
                disabled={loading}
                className={`text-sm px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 ${
                  deleteConfirm ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 border border-red-300 hover:bg-red-50'
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
          <span className="text-sm text-gray-400 pb-2">to</span>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">To</label>
            <TimePicker value={endTime} onChange={setEndTime} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            What's happening <span className="text-gray-400">(required)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bridal party entrance"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Any details for your MC..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent resize-none"
          />
        </div>
      </div>
    </Modal>
  )
}

interface SortableRowProps {
  item: PortalTimelineItem
  onEdit: (item: PortalTimelineItem) => void
}

function SortableRow({ item, onEdit }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const approved = !item.pending_review

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 group">
      {/* Left column: time rail */}
      <div className="w-16 flex flex-col items-center">
        {/* Drag handle + time pill */}
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing transition-colors mb-2"
          tabIndex={-1}
          title="Drag to reorder"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </button>

        {/* Time pill */}
        <div className={`text-xs font-medium tabular-nums px-2 py-1 rounded-full whitespace-nowrap ${
          item.start_time
            ? approved
              ? 'bg-gray-100 text-gray-700'
              : 'bg-gray-50 text-gray-500'
            : 'text-gray-300'
        }`}>
          {item.start_time ? formatTimeDisplay(item.start_time) : '—'}
        </div>

        {/* Connecting line (bottom half) */}
        <div className="flex-1 w-px bg-gray-100 mt-2" />
      </div>

      {/* Right column: card */}
      <div
        onClick={() => onEdit(item)}
        className={`flex-1 relative rounded-xl border bg-white hover:shadow-sm transition-all cursor-pointer mb-3 ${
          approved ? 'border-gray-200 hover:border-gray-300' : 'border-amber-100 hover:border-amber-200 bg-amber-50'
        }`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${approved ? 'bg-gray-900' : 'bg-amber-300'}`} />
        <div className="pl-4 pr-4 py-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            {item.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
            )}
            {item.duration_min && (
              <p className="text-xs text-gray-400 mt-1">{item.duration_min} min</p>
            )}
          </div>
          {item.pending_review && (
            <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
              Pending
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface TimelineSectionProps {
  token: string
  initialItems: PortalTimelineItem[]
  hasEvent: boolean
}

export function TimelineSection({ token, initialItems, hasEvent }: TimelineSectionProps) {
  const [items, setItems] = useState<PortalTimelineItem[]>(initialItems)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortalTimelineItem | null>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleOpenAdd = () => {
    setEditingItem(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: PortalTimelineItem) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setEditingItem(null)
  }

  const handleSave = async (data: {
    start_time: string | null
    title: string
    description: string | null
    duration_min: number | null
  }) => {
    setSaving(true)
    const supabase = anonSupabase()
    const newId = editingItem?.id ?? crypto.randomUUID()

    const { data: returnedId } = await supabase.rpc('save_portal_timeline_item', {
      p_token: token,
      p_id: newId,
      p_start_time: data.start_time,
      p_title: data.title,
      p_description: data.description,
      p_duration_min: data.duration_min,
    })

    if (returnedId) {
      if (editingItem) {
        setItems((prev) => prev.map((i) =>
          i.id === editingItem.id ? { ...i, ...data } : i
        ))
      } else {
        setItems((prev) => [...prev, {
          id: returnedId as string,
          ...data,
          position: (prev.length + 1) * 1000,
          pending_review: true,
        }])
      }
    }

    setSaving(false)
    handleClose()
  }

  const handleDelete = async () => {
    if (!editingItem) return
    setItems((prev) => prev.filter((i) => i.id !== editingItem.id))
    const supabase = anonSupabase()
    await supabase.rpc('delete_portal_timeline_item', { p_token: token, p_id: editingItem.id })
    handleClose()
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  if (!hasEvent) {
    return (
      <p className="text-sm text-gray-400 py-2">
        Your MC will set up a timeline for your event. Check back soon.
      </p>
    )
  }

  const mcItems = items.filter((i) => !i.pending_review)
  const pendingItems = items.filter((i) => i.pending_review)

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5">
        <p className="text-sm text-gray-500">
          Moments you add will be reviewed by your MC before going on the official timeline. Your MC may also add items directly.
        </p>
      </div>

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="relative pl-8">
              {/* Vertical line behind everything */}
              <div className="absolute left-7 top-0 bottom-0 w-px bg-gray-200" />

              <div className="space-y-2">
                {mcItems.length > 0 && (
                  <p className="text-sm font-medium text-gray-500 pl-8">Added by your MC</p>
                )}
                {mcItems.map((item) => (
                  <SortableRow key={item.id} item={item} onEdit={handleOpenEdit} />
                ))}
                {pendingItems.length > 0 && (
                  <p className="text-sm font-medium text-gray-500 pl-8 mt-6">Your suggestions</p>
                )}
                {pendingItems.map((item) => (
                  <SortableRow key={item.id} item={item} onEdit={handleOpenEdit} />
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={handleOpenAdd}
        className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl py-3 hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Plus size={14} strokeWidth={1.5} />
        Add moment
      </button>

      <ItemModal
        isOpen={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        onDelete={editingItem ? handleDelete : undefined}
        item={editingItem}
        loading={saving}
      />
    </div>
  )
}
