'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Edit2, Trash2, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { Event } from '../events/events-types'
import { EventModal } from './event-modal'
import { Couple } from './couples-types'

interface CoupleEventsProps {
  couple: Couple
}

export function CoupleEvents({ couple }: CoupleEventsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingVendorIds, setEditingVendorIds] = useState<string[]>([])

  const { data: events, isLoading } = useQuery({
    queryKey: ['couple-events', couple.id],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('couple_id', couple.id)
        .eq('user_id', user.user.id)
        .order('date', { ascending: true })

      if (error) throw error
      return (data || []) as Event[]
    },
  })

  const createEvent = useMutation({
    mutationFn: async (eventData: Omit<Event, 'id' | 'user_id' | 'created_at'> & { vendorIds?: string[] }) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { vendorIds, ...rest } = eventData
      const { data, error } = await supabase
        .from('events')
        .insert({
          ...rest,
          user_id: user.user.id,
        })
        .select()

      if (error) throw error
      const newEvent = data?.[0] as Event

      // Link contacts if any selected
      if (vendorIds && vendorIds.length > 0 && newEvent) {
        const contactLinks = vendorIds.map((contactId) => ({
          event_id: newEvent.id,
          contact_id: contactId,
          user_id: user.user.id,
        }))
        await supabase.from('event_contacts').insert(contactLinks)
      }

      return newEvent
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      if (newEvent) {
        queryClient.invalidateQueries({ queryKey: ['event-contacts', newEvent.id] })
      }
      setShowModal(false)
      toast('Event added')
    },
  })

  const updateEvent = useMutation({
    mutationFn: async (eventData: Event & { vendorIds?: string[] }) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { vendorIds, ...rest } = eventData
      const { error } = await supabase
        .from('events')
        .update({
          date: rest.date,
          venue: rest.venue,
          price: rest.price,
          status: rest.status,
          timeline_notes: rest.timeline_notes,
        })
        .eq('id', rest.id)

      if (error) throw error

      // Sync contacts if provided
      if (vendorIds !== undefined) {
        // Remove existing links
        await supabase
          .from('event_contacts')
          .delete()
          .eq('event_id', rest.id)

        // Insert new links
        if (vendorIds.length > 0) {
          const contactLinks = vendorIds.map((contactId) => ({
            event_id: rest.id,
            contact_id: contactId,
            user_id: user.user.id,
          }))
          await supabase.from('event_contacts').insert(contactLinks)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      if (editingEvent) {
        queryClient.invalidateQueries({ queryKey: ['event-contacts', editingEvent.id] })
      }
      setShowModal(false)
      setEditingEvent(undefined)
      toast('Event updated')
    },
  })

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      setDeleteConfirm(null)
      toast('Event deleted')
    },
  })

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string; vendorIds?: string[] }) => {
    if (eventData.id && editingEvent) {
      await updateEvent.mutateAsync({ ...editingEvent, ...eventData } as Event & { vendorIds?: string[] })
    } else {
      await createEvent.mutateAsync(eventData)
    }
  }

  const handleDeleteEvent = (eventId: string) => {
    setDeleteConfirm(eventId)
  }

  const handleConfirmDeleteEvent = () => {
    if (deleteConfirm) {
      deleteEvent.mutate(deleteConfirm)
    }
  }

  const handleDeleteFromModal = async () => {
    if (!editingEvent) return
    await deleteEvent.mutateAsync(editingEvent.id)
    setShowModal(false)
    setEditingEvent(undefined)
    setEditingVendorIds([])
  }

  const handleEditEvent = async (event: Event) => {
    // Fetch existing vendor links for this event
    const { data: user } = await supabase.auth.getUser()
    if (user?.user) {
      const { data: contactLinks } = await supabase
        .from('event_contacts')
        .select('contact_id')
        .eq('event_id', event.id)
        .eq('user_id', user.user.id)

      setEditingVendorIds((contactLinks || []).map((l: { contact_id: string }) => l.contact_id))
    } else {
      setEditingVendorIds([])
    }
    setEditingEvent(event)
    setShowModal(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const loading = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending

  return (
    <>
      <div className="space-y-3">
        {!events || events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No events yet.</p>
            <button
              onClick={() => {
                setEditingEvent(undefined)
                setEditingVendorIds([])
                setShowModal(true)
              }}
              className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
            >
              + Add Event
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{formatDate(event.date)}</p>
                    {event.venue && (
                      <p className="text-xs text-gray-500">{event.venue}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/events/${event.id}/timeline`}
                      className="p-1 text-gray-400 hover:text-gray-600 transition"
                      title="Open timeline"
                    >
                      <CalendarClock size={16} strokeWidth={1.5} />
                    </Link>
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                    >
                      <Edit2 size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      disabled={loading}
                      className="p-1 text-gray-400 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setEditingEvent(undefined)
                setEditingVendorIds([])
                setShowModal(true)
              }}
              className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
            >
              + Add Event
            </button>
          </>
        )}
      </div>

      <EventModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingEvent(undefined)
          setEditingVendorIds([])
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteFromModal : undefined}
        event={editingEvent}
        coupleId={couple.id}
        loading={loading}
        initialVendorIds={editingVendorIds}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[70]"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="fixed inset-0 z-[80] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4">
              <div className="px-6 py-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Event
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDeleteEvent}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
