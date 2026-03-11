'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Edit2, Trash2 } from 'lucide-react'
import { Event } from '../events/events-types'
import { EventModal } from './event-modal'
import { Couple } from './couples-types'

interface CoupleEventsProps {
  couple: Couple
}

export function CoupleEvents({ couple }: CoupleEventsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
    mutationFn: async (eventData: Omit<Event, 'id' | 'user_id' | 'created_at'>) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          user_id: user.user.id,
        })
        .select()

      if (error) throw error
      return data?.[0] as Event
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      setShowModal(false)
    },
  })

  const updateEvent = useMutation({
    mutationFn: async (eventData: Event) => {
      const { error } = await supabase
        .from('events')
        .update({
          date: eventData.date,
          venue: eventData.venue,
          status: eventData.status,
          timeline_notes: eventData.timeline_notes,
        })
        .eq('id', eventData.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      setShowModal(false)
      setEditingEvent(undefined)
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
      setDeleteConfirm(null)
    },
  })

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string }) => {
    if (eventData.id && editingEvent) {
      await updateEvent.mutateAsync({ ...editingEvent, ...eventData })
    } else {
      await createEvent.mutateAsync(eventData)
    }
  }

  const handleDeleteEvent = (eventId: string) => {
    if (deleteConfirm === eventId) {
      deleteEvent.mutate(eventId)
    } else {
      setDeleteConfirm(eventId)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
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
                setShowModal(true)
              }}
              className="text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
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
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{formatDate(event.date)}</p>
                    {event.venue && (
                      <p className="text-xs text-gray-500">{event.venue}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingEvent(event)
                        setShowModal(true)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      disabled={loading}
                      className={`p-1 transition ${
                        deleteConfirm === event.id
                          ? 'text-red-600 bg-red-50 rounded'
                          : 'text-gray-400 hover:text-red-600'
                      }`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setEditingEvent(undefined)
                setShowModal(true)
              }}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
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
          setDeleteConfirm(null)
        }}
        onSave={handleSaveEvent}
        event={editingEvent}
        coupleId={couple.id}
        loading={loading}
      />
    </>
  )
}
