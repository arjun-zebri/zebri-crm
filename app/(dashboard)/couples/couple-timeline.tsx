'use client'

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Check, Clock } from 'lucide-react'
import { useState, useCallback } from 'react'

import { EventDayCalendar } from '@/components/events/event-day-calendar'
import { EventTimelineModal } from '@/components/events/event-timeline-modal'
import {
  deleteTimelineItemAction,
  updateTimelineItemAction,
} from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/client'
import { TimelineItem } from '@/types/event'

import { CoupleTabEmpty, CoupleTabShell, tabStat } from './couple-tab-shell'

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}



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

// ── DnD helpers ─────────────────────────────────────────────────────────────

function DroppableSection({ id, children, isUnscheduled }: {
  id: string
  children: React.ReactNode
  isUnscheduled?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef}>
      {children}
      <div className={`h-16 rounded-control border-2 border-dashed mt-2 transition-colors duration-150 ${
        isOver
          ? isUnscheduled
            ? 'border-gray-300 bg-gray-100'
            : 'border-amber-300 bg-amber-50'
          : 'border-transparent'
      }`} />
    </div>
  )
}

function DraggableSidebarCard({ id, children, className, onClick }: {
  id: string
  children: React.ReactNode
  className: string
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${className} ${isDragging ? 'opacity-30' : ''} cursor-grab active:cursor-grabbing`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}


// ── Main component ───────────────────────────────────────────────────────────

interface CoupleTimelineProps {
  coupleId: string
  coupleName?: string
}

export function CoupleTimeline({ coupleId, coupleName }: CoupleTimelineProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Item edit modal (shared for unscheduled + review cards)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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

  // Shared cache key with EventDayCalendar - no extra network call
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

  const { isLoading: contactsLoading } = useQuery({
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
      const patch: Record<string, unknown> = {}
      if (rest.title !== undefined) patch.title = rest.title
      if (rest.start_time !== undefined) patch.start_time = rest.start_time
      if (rest.description !== undefined) patch.description = rest.description
      if (rest.duration_min !== undefined) patch.duration_min = rest.duration_min
      if (rest.contact_id !== undefined) patch.contact_id = rest.contact_id
      if (rest.position !== undefined) patch.position = rest.position
      if (rest.pending_review !== undefined) patch.pending_review = rest.pending_review
      unwrap(await updateTimelineItemAction({ id, patch }))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-timeline', activeEventId] }),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTimelineItemAction(id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-timeline', activeEventId] }),
  })

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return // CalendarDndMonitor handles calendar-internal drops
    const itemId = active.id as string
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    if (over.id === 'drop-unscheduled') {
      if (!item.start_time && !item.pending_review) return
      queryClient.setQueryData(['event-timeline', activeEventId], (old: TimelineItem[] = []) =>
        old.map((i) => i.id === itemId ? { ...i, start_time: null, pending_review: false } : i)
      )
      updateItem.mutate({ id: itemId, start_time: null, pending_review: false })
    } else if (over.id === 'drop-review') {
      if (item.pending_review) return
      queryClient.setQueryData(['event-timeline', activeEventId], (old: TimelineItem[] = []) =>
        old.map((i) => i.id === itemId ? { ...i, pending_review: true } : i)
      )
      updateItem.mutate({ id: itemId, pending_review: true })
    }
  }, [items, updateItem, queryClient, activeEventId])

  const isLoading = eventsLoading || (!!activeEventId && (itemsLoading || contactsLoading))
  const activeEvent = events.find((e) => e.id === activeEventId) ?? events[0]
  const exportFilename = [
    coupleName,
    activeEvent?.date,
    'timeline',
  ].filter(Boolean).join(' - ')
  const unscheduledItems = items.filter((i) => !i.start_time && !i.pending_review)
  const reviewItems = items.filter((i) => i.pending_review)

  return (
    <CoupleTabShell
      title="Timeline"
      stats={events.length > 0 ? [{ label: tabStat(events.length, 'event') }] : undefined}
    >
      {isLoading ? (
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 flex-1 animate-pulse">
          {/* Left: calendar area */}
          <div className="flex-[3] space-y-2">
            <div className="h-8 w-44 bg-gray-100 rounded-control mb-4" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-control" />
            ))}
          </div>
          {/* Right: Unscheduled + To Review */}
          <div className="w-full sm:w-[260px] flex-shrink-0 flex flex-col gap-8 pt-1">
            <div>
              <div className="h-3 w-20 bg-gray-100 rounded-pill mb-4" />
              {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-control mb-2" />)}
            </div>
            <div>
              <div className="h-3 w-16 bg-gray-100 rounded-pill mb-4" />
              <div className="h-12 bg-gray-100 rounded-control" />
            </div>
          </div>
        </div>
      ) : events.length === 0 ? (
        <CoupleTabEmpty
          icon={Clock}
          title="No events yet"
          description="Add an event to this couple to start building a timeline."
        />
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Top bar: event selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Custom event dropdown */}
            <Popover.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <Popover.Trigger asChild>
                <button type="button" className="inline-flex items-center gap-2 border border-gray-200 rounded-control px-3 py-2 text-sm bg-white hover:bg-gray-50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200">
                  <span className="text-gray-700">{activeEvent ? `${formatDate(activeEvent.date)}${activeEvent.venue ? `, ${activeEvent.venue}` : ''}` : ''}</span>
                  {events.length > 1 && <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                </button>
              </Popover.Trigger>
            {events.length > 1 && (
              <Popover.Portal>
                <Popover.Content className="bg-white border border-gray-200 rounded-control shadow-lg py-1 z-[70] w-64" sideOffset={4} align="start">
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
          </div>

          {/* 3/5 + 2/5 layout */}
          {activeEventId && (
            <DndContext
              sensors={sensors}
              onDragStart={(e) => setActiveId(e.active.id as string)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 flex-1 min-h-0">
                {/* Left: timeline calendar */}
                <div className="flex-[3] min-w-0">
                  <EventDayCalendar eventId={activeEventId} hideShareLink hideUnscheduled skipDndContext showItemStatus exportFilename={exportFilename} />
                </div>

                {/* Right: unscheduled + to review */}
                <div className="w-full sm:w-[260px] flex-shrink-0 flex flex-col gap-8 overflow-y-auto pt-1 pb-6 sm:pb-2">
                  {/* Unscheduled */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">Unscheduled</h3>
                    <DroppableSection id="drop-unscheduled" isUnscheduled>
                      {unscheduledItems.length === 0 ? (
                        <p className="text-sm text-gray-300 px-1 py-2">Drag here to unschedule</p>
                      ) : (
                        <div className="space-y-2 py-1">
                          {unscheduledItems.map((item) => (
                            <DraggableSidebarCard
                              key={item.id}
                              id={item.id}
                              className="flex flex-col gap-0.5 px-3 py-2.5 border border-dashed border-gray-200 rounded-control hover:border-gray-300 hover:bg-gray-50 transition"
                              onClick={() => { setEditingItem(item); setEditModalOpen(true) }}
                            >
                              <p className="text-xs font-medium text-gray-700 truncate">{item.title}</p>
                              {item.contact && <p className="text-xs text-gray-400 truncate">{item.contact.name}</p>}
                              {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>}
                            </DraggableSidebarCard>
                          ))}
                        </div>
                      )}
                    </DroppableSection>
                  </div>

                  {/* To Review */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">To Review</h3>
                    <DroppableSection id="drop-review">
                      {reviewItems.length === 0 ? (
                        <p className="text-sm text-gray-300 px-1 py-2">Drag here to review</p>
                      ) : (
                        <div className="space-y-2 py-1">
                          {reviewItems.map((item) => (
                            <DraggableSidebarCard
                              key={item.id}
                              id={item.id}
                              className="flex flex-col gap-0.5 px-3 py-2.5 border border-amber-200 border-l-2 border-l-amber-400 rounded-control hover:bg-amber-50/50 transition"
                              onClick={() => { setEditingItem(item); setEditModalOpen(true) }}
                            >
                              <p className="text-xs font-medium text-gray-700 truncate">{item.title}</p>
                              {item.start_time && <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.start_time)}</p>}
                              {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>}
                            </DraggableSidebarCard>
                          ))}
                        </div>
                      )}
                    </DroppableSection>
                  </div>
                </div>
              </div>

              <DragOverlay>
                {activeId ? (
                  <div className="w-52 px-3 py-2.5 bg-white border border-gray-300 rounded-control shadow-lg text-xs font-medium text-gray-700 cursor-grabbing truncate">
                    {items.find((i) => i.id === activeId)?.title ?? ''}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* Sidebar item edit modal (unscheduled + review) */}
      <EventTimelineModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingItem(null) }}
        onSave={(data) => {
          if (!editingItem) return
          updateItem.mutate({ id: editingItem.id, ...data }, { onSuccess: () => { setEditModalOpen(false); setEditingItem(null) } })
        }}
        onDelete={editingItem ? () => deleteItem.mutate(editingItem.id, { onSuccess: () => { setEditModalOpen(false); setEditingItem(null) } }) : undefined}
        item={editingItem}
        loading={updateItem.isPending || deleteItem.isPending}
        showStatus
      />
    </CoupleTabShell>
  )
}
