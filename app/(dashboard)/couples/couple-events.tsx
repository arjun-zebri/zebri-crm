'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Event } from '../events/events-types'

type EventWithTime = Event & { start_time?: string | null }
import { EventModal } from './event-modal'
import { Couple } from './couples-types'

interface CoupleEventsProps {
  couple: Couple
  onLoadingChange?: (loading: boolean) => void
}

async function recalculateDriveTimes(coupleId: string, date: string, queryClient: QueryClient) {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return

  const meta = userData.user.user_metadata as { address_lat?: number; address_lng?: number } | null
  const homeLat = meta?.address_lat
  const homeLng = meta?.address_lng

  const { data: events } = await supabase
    .from('events')
    .select('id, venue_lat, venue_lng, drive_time_from_home_seconds, drive_time_to_next_event_seconds')
    .eq('couple_id', coupleId)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (!events || events.length === 0) return

  const updates: { id: string; drive_time_from_home_seconds: number | null; drive_time_to_next_event_seconds: number | null }[] = []

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    let fromHome: number | null = null
    let toNext: number | null = null

    if (ev.venue_lat && ev.venue_lng) {
      if (homeLat && homeLng) {
        try {
          const r = await fetch(`/api/drive-time?origin_lat=${homeLat}&origin_lng=${homeLng}&dest_lat=${ev.venue_lat}&dest_lng=${ev.venue_lng}`)
          const d = await r.json()
          if (typeof d.duration_seconds === 'number') fromHome = d.duration_seconds
        } catch { /* best-effort */ }
      }

      const next = events[i + 1]
      if (next?.venue_lat && next?.venue_lng) {
        try {
          const r = await fetch(`/api/drive-time?origin_lat=${ev.venue_lat}&origin_lng=${ev.venue_lng}&dest_lat=${next.venue_lat}&dest_lng=${next.venue_lng}`)
          const d = await r.json()
          if (typeof d.duration_seconds === 'number') toNext = d.duration_seconds
        } catch { /* best-effort */ }
      }
    }

    updates.push({ id: ev.id, drive_time_from_home_seconds: fromHome, drive_time_to_next_event_seconds: toNext })
  }

  await Promise.all(
    updates.map((u) =>
      supabase
        .from('events')
        .update({ drive_time_from_home_seconds: u.drive_time_from_home_seconds, drive_time_to_next_event_seconds: u.drive_time_to_next_event_seconds })
        .eq('id', u.id)
    )
  )

  queryClient.invalidateQueries({ queryKey: ['couple-events', coupleId] })
}

function formatDriveTime(seconds: number): string {
  return `~${Math.round(seconds / 60)} min`
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const main = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const dow = d.toLocaleDateString('en-AU', { weekday: 'short' })
  return `${main} · ${dow}`
}

function formatEventTime(time: string | null | undefined): string | null {
  if (!time) return null
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

export function CoupleEvents({ couple, onLoadingChange }: CoupleEventsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()
  const [editingVendorIds, setEditingVendorIds] = useState<string[]>([])
  const [calculatingDriveTime, setCalculatingDriveTime] = useState(false)

  const { data: events, isLoading } = useQuery({
    queryKey: ['couple-events', couple.id],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .select('*, timeline_items(start_time)')
        .eq('couple_id', couple.id)
        .eq('user_id', user.user.id)
        .order('date', { ascending: true })

      if (error) throw error

      return (data || []).map((row: Event & { timeline_items?: { start_time: string | null }[] }) => {
        const times = (row.timeline_items ?? [])
          .map((t) => t.start_time)
          .filter((t): t is string => !!t)
          .sort()
        const { timeline_items: _ignored, ...rest } = row
        void _ignored
        return { ...rest, start_time: times[0] ?? null } as EventWithTime
      })
    },
    placeholderData: (prev) => prev,
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

      // Auto-create venue as a contact and link to event if it came from Places
      const extraContactIds: string[] = []
      if (newEvent && rest.venue && rest.venue_lat && rest.venue_lng) {
        try {
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.user.id)
            .eq('category', 'venue')
            .ilike('name', rest.venue)
            .limit(1)

          let venueContactId: string | null = null

          if (!existing || existing.length === 0) {
            const { data: created } = await supabase
              .from('contacts')
              .insert({
                user_id: user.user.id,
                name: rest.venue,
                category: 'venue',
                phone: rest.venue_phone ?? '',
                email: '',
                contact_name: '',
                notes: rest.venue_website ?? '',
                status: 'active',
              })
              .select('id')
              .single()
            venueContactId = created?.id ?? null
          } else {
            venueContactId = existing[0].id
          }

          if (venueContactId) {
            extraContactIds.push(venueContactId)
            // Also link to the couple
            await supabase
              .from('couple_contacts')
              .upsert(
                { couple_id: couple.id, contact_id: venueContactId, user_id: user.user.id },
                { onConflict: 'couple_id,contact_id', ignoreDuplicates: true }
              )
          }
        } catch {
          // Silently skip - contact creation is best-effort
        }
      }

      // Link contacts if any selected (manual + auto-created venue)
      const allContactIds = [...(vendorIds ?? []), ...extraContactIds.filter(id => !(vendorIds ?? []).includes(id))]
      if (allContactIds.length > 0 && newEvent) {
        const contactLinks = allContactIds.map((contactId) => ({
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
              duration_min: 30,
              position: 1000,
              pending_review: false,
            })
          }
        } catch {
          // Silently skip - sunset is a bonus, not critical
        }
      }

      return newEvent
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', couple.id] })
      if (newEvent) {
        queryClient.invalidateQueries({ queryKey: ['event-contacts', newEvent.id] })
        queryClient.invalidateQueries({ queryKey: ['timeline-items', newEvent.id] })
      }
      setShowModal(false)
      toast('Event added')
      if (newEvent?.date) {
        setCalculatingDriveTime(true)
        recalculateDriveTimes(couple.id, newEvent.date, queryClient).finally(() => setCalculatingDriveTime(false))
      }
    },
    onError: (err) => {
      console.error('[couple-events] create failed', err)
      toast(err instanceof Error ? `Failed to add event: ${err.message}` : 'Failed to add event')
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      if (editingEvent) {
        queryClient.invalidateQueries({ queryKey: ['event-contacts', editingEvent.id] })
      }
      setShowModal(false)
      setEditingEvent(undefined)
      toast('Event updated')
      if (variables?.date) {
        setCalculatingDriveTime(true)
        recalculateDriveTimes(couple.id, variables.date, queryClient).finally(() => setCalculatingDriveTime(false))
      }
    },
    onError: () => toast('Failed to update event'),
  })

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      // Fetch date before deleting so we can recalculate afterwards
      const { data: toDelete } = await supabase
        .from('events')
        .select('date')
        .eq('id', eventId)
        .single()

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error

      return toDelete?.date ?? null
    },
    onSuccess: (date) => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast('Event deleted')
      if (date) {
        setCalculatingDriveTime(true)
        recalculateDriveTimes(couple.id, date, queryClient).finally(() => setCalculatingDriveTime(false))
      }
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
          className="group flex items-center gap-1.5 mb-3 cursor-pointer"
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
          <div className="space-y-5">
            {events.reduce<EventWithTime[][]>((acc, ev) => {
              const last = acc[acc.length - 1]
              if (last && last[0].date === ev.date) { last.push(ev) } else { acc.push([ev]) }
              return acc
            }, []).map((group) => (
              <div key={`${group[0].date}-${group[0].id}`}>
                <p className="text-xs text-gray-400 mb-2">{formatGroupDate(group[0].date)}</p>
                <div className="relative">
                  <div className="absolute left-[4px] top-2 bottom-2 w-px bg-gray-200" aria-hidden />
                  {group.map((event, idx) => {
                    const time = formatEventTime(event.start_time)
                    const driveLabel = event.drive_time_from_home_seconds != null
                      ? `${formatDriveTime(event.drive_time_from_home_seconds)} from home`
                      : null
                    const meta = [time, driveLabel].filter(Boolean).join(' · ')
                    return (
                    <div key={event.id}>
                      <div
                        onClick={() => handleEditEvent(event)}
                        className="group relative pl-6 py-1.5 cursor-pointer"
                      >
                        <span
                          className="absolute left-0 top-2.5 w-[9px] h-[9px] rounded-full ring-2 ring-white bg-emerald-200"
                          aria-hidden
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-700 truncate">{event.venue || 'Untitled'}</p>
                          <Pencil size={11} strokeWidth={1.5} className="text-gray-400 opacity-0 group-hover:opacity-60 shrink-0 ml-2" />
                        </div>
                        {calculatingDriveTime ? (
                          <p className="text-xs text-gray-300 mt-0.5">Calculating...</p>
                        ) : meta ? (
                          <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
                        ) : null}
                      </div>
                      {event.drive_time_to_next_event_seconds != null && idx < group.length - 1 && (
                        <p className="text-xs text-gray-400 pl-6 py-1.5">→ {formatDriveTime(event.drive_time_to_next_event_seconds)} drive</p>
                      )}
                    </div>
                  )})}
                </div>
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
