'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Event } from '../events/events-types'
import { EventModal } from './event-modal'
import { Couple } from './couples-types'

interface CoupleEventsProps {
  couple: Couple
  onLoadingChange?: (loading: boolean) => void
}

export function CoupleEvents({ couple, onLoadingChange }: CoupleEventsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()
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

  useEffect(() => { onLoadingChange?.(isLoading) }, [isLoading])

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

      // Auto-insert sunset timeline item if we have coordinates
      if (newEvent && rest.venue_lat && rest.venue_lng && rest.date) {
        try {
          const sunsetRes = await fetch(
            `https://api.sunrise-sunset.org/json?lat=${rest.venue_lat}&lng=${rest.venue_lng}&date=${rest.date}&formatted=0`
          )
          const sunsetData = await sunsetRes.json()
          if (sunsetData.status === 'OK' && sunsetData.results?.sunset) {
            const sunsetDate = new Date(sunsetData.results.sunset)
            const localTime = sunsetDate.toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
            await supabase.from('timeline_items').insert({
              event_id: newEvent.id,
              user_id: user.user.id,
              title: 'Sunset',
              start_time: localTime,
              position: 1000,
              pending_review: false,
            })
          }
        } catch {
          // Silently skip — sunset is a bonus, not critical
        }
      }

      return newEvent
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      if (newEvent) {
        queryClient.invalidateQueries({ queryKey: ['event-contacts', newEvent.id] })
        queryClient.invalidateQueries({ queryKey: ['timeline-items', newEvent.id] })
      }
      setShowModal(false)
      toast('Event added')
    },
    onError: () => toast('Failed to add event'),
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
          venue_phone: rest.venue_phone,
          venue_website: rest.venue_website,
          venue_lat: rest.venue_lat,
          venue_lng: rest.venue_lng,
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
    onError: () => toast('Failed to update event'),
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
      toast('Event deleted')
    },
    onError: () => toast('Failed to delete event'),
  })

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string; vendorIds?: string[] }) => {
    if (eventData.id && editingEvent) {
      await updateEvent.mutateAsync({ ...editingEvent, ...eventData } as Event & { vendorIds?: string[] })
    } else {
      await createEvent.mutateAsync(eventData)
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

  const loading = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <button
          onClick={() => {
            setEditingEvent(undefined)
            setEditingVendorIds([])
            setShowModal(true)
          }}
          className="group flex items-center gap-1.5 mb-1 cursor-pointer"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">Events</h3>
          <Plus size={12} strokeWidth={2} className="text-gray-900 group-hover:text-gray-600 transition" />
        </button>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-gray-400 py-1">No events yet.</p>
        ) : (
          <div className="space-y-0">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => handleEditEvent(event)}
                className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2 transition cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500">{formatDate(event.date)}</p>
                  {event.venue && (
                    <p className="text-xs text-gray-400">{event.venue}</p>
                  )}
                </div>
                <Pencil size={11} strokeWidth={1.5} className="text-gray-400 opacity-0 group-hover:opacity-60 shrink-0" />
              </div>
            ))}
          </div>
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

    </>
  )
}
