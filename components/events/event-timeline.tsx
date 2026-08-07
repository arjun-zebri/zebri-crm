'use client'

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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Check } from 'lucide-react'
import { useState } from 'react'

import { useToast } from '@/components/ui/toast'
import {
  createTimelineItemAction,
  deleteTimelineItemAction,
  rotateEventShareTokenAction,
  setEventShareEnabledAction,
  updateTimelineItemAction,
} from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/types/contact'
import { TimelineItem } from '@/types/event'

import { EventTimelineModal } from './event-timeline-modal'
import { EventTimelineShare } from './event-timeline-share'

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}


interface EventShare {
  share_token: string | null
  share_token_enabled: boolean
}

function formatTime(time: string | null | undefined): string {
  if (!time) return '-'
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

interface SortableItemRowProps {
  item: TimelineItem
  onEdit: (item: TimelineItem) => void
  onApprove?: (id: string) => void
}

function SortableItemRow({ item, onEdit, onApprove }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const categoryLabel =
    item.contact?.category
      ? CATEGORY_LABELS[item.contact.category as keyof typeof CATEGORY_LABELS] ||
        item.contact.category
      : null

  const hasTimed = !!item.start_time
  const isPending = !!item.pending_review

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-2 group">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="hidden sm:flex items-center text-gray-200 hover:text-text-subtle cursor-grab active:cursor-grabbing touch-none transition-colors opacity-0 group-hover:opacity-100 px-0.5"
        tabIndex={-1}
      >
        <GripVertical size={15} strokeWidth={1.5} />
      </button>

      {/* Calendar-style event card */}
      <div
        onClick={() => onEdit(item)}
        className={`flex-1 relative overflow-hidden rounded-control border bg-surface hover:shadow-sm transition-all cursor-pointer ${
          isPending ? 'border-amber-200 hover:border-amber-300' : 'border-border hover:border-border-strong'
        }`}
      >
        {/* Left accent strip */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-[3px] ${
            isPending ? 'bg-amber-300' : hasTimed ? 'bg-emerald-400' : 'bg-gray-200'
          }`}
        />

        <div className="pl-4 pr-3 py-2.5">
          {/* Time + duration row */}
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-body tabular-nums font-medium ${
                hasTimed ? 'text-emerald-600' : 'text-gray-300'
              }`}
            >
              {hasTimed ? formatTime(item.start_time) : 'No time'}
            </span>
            <div className="flex items-center gap-2">
              {isPending && (
                <span className="text-body bg-amber-50 text-amber-600 border border-amber-100 rounded-pill px-2 py-0.5">
                  Pending
                </span>
              )}
              {item.duration_min && (
                <span className="text-body text-text-subtle tabular-nums">{item.duration_min} min</span>
              )}
            </div>
          </div>

          {/* Title */}
          <p className="text-body font-semibold text-text leading-snug">{item.title}</p>

          {/* Contact */}
          {item.contact && (
            <p className="text-body text-text-muted mt-0.5">
              {item.contact.name}
              {categoryLabel ? ` · ${categoryLabel}` : ''}
            </p>
          )}

          {/* Notes preview */}
          {item.description && (
            <p className="text-body text-text-subtle mt-1 truncate">{item.description}</p>
          )}
        </div>
      </div>

      {/* Approve button for pending items */}
      {isPending && onApprove && (
        <button
          onClick={(e) => { e.stopPropagation(); onApprove(item.id) }}
          className="flex items-center gap-1 text-body text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-control px-2.5 hover:bg-emerald-100 transition cursor-pointer shrink-0 self-stretch"
          title="Approve"
        >
          <Check size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

interface EventTimelineProps {
  eventId: string
}

export function EventTimeline({ eventId }: EventTimelineProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Fetch timeline items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['event-timeline', eventId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('timeline_items')
        .select('*, contact:contact_id(id, name, category)')
        .eq('event_id', eventId)
        .eq('user_id', user.user.id)
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('position', { ascending: true })

      if (error) throw error
      return (data || []) as TimelineItem[]
    },
  })


  // Fetch event share settings
  const { data: shareData } = useQuery({
    queryKey: ['event-share', eventId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .select('share_token, share_token_enabled')
        .eq('id', eventId)
        .eq('user_id', user.user.id)
        .single()

      if (error) throw error
      return data as EventShare
    },
  })

  const addItem = useMutation({
    mutationFn: async (
      itemData: Omit<TimelineItem, 'id' | 'event_id' | 'user_id' | 'created_at' | 'contact'>
    ) => {
      const maxPosition = items.length > 0 ? Math.max(...items.map((i) => i.position)) : 0
      unwrap(
        await createTimelineItemAction({
          event_id: eventId,
          title: itemData.title,
          start_time: itemData.start_time ?? null,
          description: itemData.description ?? null,
          duration_min: itemData.duration_min ?? null,
          contact_id: itemData.contact_id ?? null,
          position: maxPosition + 1000,
          pending_review: itemData.pending_review,
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', eventId] })
      setShowModal(false)
      toast('Item added')
    },
  })

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<TimelineItem> & { id: string }) => {
      // Only forward fields the timeline-item patch schema accepts.
      const { title, start_time, description, duration_min, contact_id, position, pending_review } = data
      const patch: Record<string, unknown> = {}
      if (title !== undefined) patch.title = title
      if (start_time !== undefined) patch.start_time = start_time
      if (description !== undefined) patch.description = description
      if (duration_min !== undefined) patch.duration_min = duration_min
      if (contact_id !== undefined) patch.contact_id = contact_id
      if (position !== undefined) patch.position = position
      if (pending_review !== undefined) patch.pending_review = pending_review
      unwrap(await updateTimelineItemAction({ id, patch }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', eventId] })
      setShowModal(false)
      setEditingItem(null)
      toast('Item updated')
    },
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTimelineItemAction(id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', eventId] })
      setShowModal(false)
      setEditingItem(null)
      toast('Item deleted')
    },
  })

  const toggleShare = useMutation({
    mutationFn: async (enabled: boolean) => {
      unwrap(await setEventShareEnabledAction(eventId, enabled))
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['event-share', eventId] })
      toast(enabled ? 'Share link enabled' : 'Share link disabled')
    },
  })

  const regenerateToken = useMutation({
    mutationFn: async () => {
      unwrap(await rotateEventShareTokenAction(eventId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-share', eventId] })
      toast('Link regenerated')
    },
  })

  const approveItem = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await updateTimelineItemAction({ id, patch: { pending_review: false } }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', eventId] })
      toast('Item approved')
    },
  })

  const reorderItems = useMutation({
    mutationFn: async (reorderedIds: string[]) => {
      const updates = reorderedIds.map((id, index) => ({
        id,
        position: (index + 1) * 1000,
      }))

      for (const update of updates) {
        await supabase
          .from('timeline_items')
          .update({ position: update.position })
          .eq('id', update.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', eventId] })
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)

    // Optimistic update
    queryClient.setQueryData(['event-timeline', eventId], reordered)
    reorderItems.mutate(reordered.map((i) => i.id))
  }

  const handleSave = (
    data: Omit<TimelineItem, 'id' | 'event_id' | 'user_id' | 'created_at' | 'contact'>
  ) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...data })
    } else {
      addItem.mutate(data)
    }
  }

  const handleOpenEdit = (item: TimelineItem) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const mutating = addItem.isPending || updateItem.isPending || deleteItem.isPending

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-surface-emphasis rounded-control animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-body font-medium text-text">Timeline</p>
          <button
            onClick={handleOpenAdd}
            className="text-body text-gray-700 border border-border rounded-control px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
          >
            + Add item
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-body text-text-muted mb-3">No items yet.</p>
            <button
              onClick={handleOpenAdd}
              className="text-body text-gray-700 border border-border rounded-control px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
            >
              + Add first item
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    onEdit={handleOpenEdit}
                    onApprove={(id) => approveItem.mutate(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Share link section */}
        <EventTimelineShare
          shareToken={shareData?.share_token}
          shareEnabled={shareData?.share_token_enabled ?? false}
          onToggle={(enabled) => toggleShare.mutate(enabled)}
          onRegenerate={() => regenerateToken.mutate()}
          loading={toggleShare.isPending || regenerateToken.isPending}
        />
      </div>

      <EventTimelineModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingItem(null)
        }}
        onSave={handleSave}
        onDelete={editingItem ? () => deleteItem.mutate(editingItem.id) : undefined}
        item={editingItem}
        loading={mutating}
      />
    </>
  )
}
