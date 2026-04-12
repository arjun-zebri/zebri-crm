'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Check } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { EventDayCalendar } from '../events/event-day-calendar'
import { EventTimelineModal, TimePicker, timeToMinutes, addMinutesToTime } from '../events/event-timeline-modal'
import { TimelineItem } from '../events/events-types'

interface Event {
  id: string
  date: string
  venue: string | null
}

interface EventContact {
  contact_id: string
  contact: { id: string; name: string; category: string }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// ── Review modal for couple-submitted items ──────────────────────────────────

function ReviewItemModal({
  isOpen, onClose, onApprove, onDelete, item, loading,
}: {
  isOpen: boolean
  onClose: () => void
  onApprove: (data: Pick<TimelineItem, 'title' | 'start_time' | 'duration_min' | 'description'>) => void
  onDelete: () => void
  item: TimelineItem | null
  loading: boolean
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen && item) {
      const start = item.start_time ?? ''
      const end = start && item.duration_min ? addMinutesToTime(start, item.duration_min) : start ? addMinutesToTime(start, 60) : ''
      setTitle(item.title)
      setStartTime(start)
      setEndTime(end)
      setDescription(item.description ?? '')
      setConfirmDelete(false)
    }
  }, [isOpen, item])

  const handleStartChange = (val: string) => {
    if (val && endTime) {
      const oldDuration = startTime && endTime ? timeToMinutes(endTime) - timeToMinutes(startTime) : 60
      setEndTime(addMinutesToTime(val, Math.max(15, oldDuration)))
    } else if (val) {
      setEndTime(addMinutesToTime(val, 60))
    }
    setStartTime(val)
  }

  const handleApprove = () => {
    if (!title.trim()) return
    const durationMin = startTime && endTime ? Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime)) : null
    onApprove({ title: title.trim(), start_time: startTime || null, duration_min: durationMin, description: description.trim() || null })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review suggestion"
      footer={
        <div className="flex items-center justify-between">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Remove this suggestion?</span>
                <button type="button" onClick={onDelete} className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer">Yes, remove</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50 transition cursor-pointer">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleApprove} disabled={loading || !title.trim()} className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              <Check size={13} strokeWidth={2} />
              {loading ? 'Approving...' : 'Approve'}
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
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
        </div>
      </div>
    </Modal>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface CoupleTimelineProps {
  coupleId: string
}

export function CoupleTimeline({ coupleId }: CoupleTimelineProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Unscheduled item edit modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null)

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewingItem, setReviewingItem] = useState<TimelineItem | null>(null)

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['couple-events', coupleId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase.from('events').select('id, date, venue').eq('couple_id', coupleId).eq('user_id', user.user.id).order('date', { ascending: true })
      if (error) throw error
      return (data || []) as Event[]
    },
  })

  const activeEventId = selectedEventId ?? events[0]?.id ?? null

  // Shared cache key with EventDayCalendar — no extra network call
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['event-timeline', activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase.from('timeline_items').select('*, contact:contact_id(id, name, category)').eq('event_id', activeEventId!).eq('user_id', user.user.id).order('start_time', { ascending: true, nullsFirst: false }).order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as TimelineItem[]
    },
  })

  const { data: eventContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['event-contacts', activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase.from('event_contacts').select('contact_id, contact:contact_id(id, name, category)').eq('event_id', activeEventId!).eq('user_id', user.user.id)
      if (error) throw error
      return (data ?? []) as unknown as EventContact[]
    },
  })

  const updateItem = useMutation({
    mutationFn: async (data: Partial<TimelineItem> & { id: string }) => {
      const { id, ...rest } = data
      const { error } = await supabase.from('timeline_items').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-timeline', activeEventId] }),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('timeline_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-timeline', activeEventId] }),
  })

  const isLoading = eventsLoading || (!!activeEventId && (itemsLoading || contactsLoading))
  const activeEvent = events.find((e) => e.id === activeEventId) ?? events[0]
  const unscheduledItems = items.filter((i) => !i.start_time && !i.pending_review)
  const reviewItems = items.filter((i) => i.pending_review)

  if (!isLoading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-400">No events yet.</p>
        <p className="text-sm text-gray-400 mt-1">Add an event to start building a timeline.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Skeleton — shown while any query is pending */}
      {isLoading && (
        <div className="flex gap-6 flex-1 animate-pulse">
          {/* Left: calendar area */}
          <div className="flex-[3] space-y-2">
            <div className="h-8 w-44 bg-gray-100 rounded-xl mb-4" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl" />
            ))}
          </div>
          {/* Right: Unscheduled + To Review */}
          <div className="w-[260px] flex-shrink-0 flex flex-col gap-8 pt-1">
            <div>
              <div className="h-3 w-20 bg-gray-100 rounded-full mb-4" />
              {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl mb-2" />)}
            </div>
            <div>
              <div className="h-3 w-16 bg-gray-100 rounded-full mb-4" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* Real content — always mounted so queries fire; hidden via CSS while loading */}
      <div className={`flex flex-col flex-1 min-h-0 gap-4 ${isLoading ? 'hidden' : ''}`}>
        {/* Custom event dropdown */}
        <Popover.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <Popover.Trigger asChild>
            <button type="button" className="self-start inline-flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white hover:bg-gray-50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200">
              <span className="text-gray-700">{activeEvent ? `${formatDate(activeEvent.date)}${activeEvent.venue ? `, ${activeEvent.venue}` : ''}` : ''}</span>
              {events.length > 1 && <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
            </button>
          </Popover.Trigger>
          {events.length > 1 && (
            <Popover.Portal>
              <Popover.Content className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-64" sideOffset={4} align="start">
                {events.map((event) => (
                  <button key={event.id} type="button"
                    onClick={() => { setSelectedEventId(event.id); setDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-sm transition flex items-center justify-between ${event.id === activeEventId ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span>{formatDate(event.date)}{event.venue ? `, ${event.venue}` : ''}</span>
                    {event.id === activeEventId && <Check size={13} className="text-gray-500" />}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          )}
        </Popover.Root>

        {/* 3/5 + 2/5 layout */}
        {activeEventId && (
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Left: timeline calendar */}
            <div className="flex-[3] min-w-0">
              <EventDayCalendar eventId={activeEventId} hideShareLink hideUnscheduled />
            </div>

            {/* Right: unscheduled + to review */}
            <div className="w-[260px] flex-shrink-0 flex flex-col gap-8 overflow-y-auto pt-1">
              {/* Unscheduled */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">Unscheduled</h3>
                {unscheduledItems.length === 0 ? (
                  <p className="text-sm text-gray-300">None</p>
                ) : (
                  <div className="space-y-2">
                    {unscheduledItems.map((item) => (
                      <div key={item.id} onClick={() => { setEditingItem(item); setEditModalOpen(true) }}
                        className="flex flex-col gap-0.5 px-3 py-2.5 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                      >
                        <p className="text-xs font-medium text-gray-700 truncate">{item.title}</p>
                        {item.contact && <p className="text-xs text-gray-400 truncate">{item.contact.name}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* To Review */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">To Review</h3>
                {reviewItems.length === 0 ? (
                  <p className="text-sm text-gray-300">No suggestions yet</p>
                ) : (
                  <div className="space-y-2">
                    {reviewItems.map((item) => (
                      <div key={item.id} onClick={() => { setReviewingItem(item); setReviewModalOpen(true) }}
                        className="px-3 py-2.5 border border-amber-200 border-l-2 border-l-amber-400 rounded-xl hover:bg-amber-50/50 transition cursor-pointer"
                      >
                        <p className="text-xs font-medium text-gray-700 truncate">{item.title}</p>
                        {item.start_time && <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.start_time)}</p>}
                        {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unscheduled edit modal */}
      <EventTimelineModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingItem(null) }}
        onSave={(data) => {
          if (!editingItem) return
          updateItem.mutate({ id: editingItem.id, ...data }, { onSuccess: () => { setEditModalOpen(false); setEditingItem(null) } })
        }}
        onDelete={editingItem ? () => deleteItem.mutate(editingItem.id, { onSuccess: () => { setEditModalOpen(false); setEditingItem(null) } }) : undefined}
        item={editingItem}
        eventContacts={eventContacts}
        loading={updateItem.isPending || deleteItem.isPending}
      />

      {/* Review modal */}
      <ReviewItemModal
        isOpen={reviewModalOpen}
        onClose={() => { setReviewModalOpen(false); setReviewingItem(null) }}
        onApprove={(data) => {
          if (!reviewingItem) return
          updateItem.mutate({ id: reviewingItem.id, ...data, pending_review: false }, { onSuccess: () => { setReviewModalOpen(false); setReviewingItem(null) } })
        }}
        onDelete={() => {
          if (!reviewingItem) return
          deleteItem.mutate(reviewingItem.id, { onSuccess: () => { setReviewModalOpen(false); setReviewingItem(null) } })
        }}
        item={reviewingItem}
        loading={updateItem.isPending || deleteItem.isPending}
      />
    </div>
  )
}
