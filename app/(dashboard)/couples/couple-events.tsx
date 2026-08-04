'use client'

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState, useEffect, useImperativeHandle, type Ref } from 'react'

import { useToast } from '@/components/ui/toast'
import {
  bulkLinkContactsToEventAction,
  createEventAction,
  createTimelineItemAction,
  deleteEventAction,
  updateEventAction,
} from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/client'
import { Couple } from '@/types/couple'
import { Event } from '@/types/event'

import { EventModal } from './event-modal'

type EventWithTime = Event & { start_time?: string | null }

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}

/** Imperative handle so a parent (the Overview header) can open the add-event modal. */
export interface CoupleEventsHandle {
  openAdd: () => void
}

interface CoupleEventsProps {
  couple: Couple
  onLoadingChange?: (loading: boolean) => void
  /** React 19 ref-as-prop exposing {@link CoupleEventsHandle}. */
  ref?: Ref<CoupleEventsHandle>
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
    .select('id, venue_lat, venue_lng, drive_time_from_home_seconds, drive_time_to_next_event_seconds, drive_distance_from_home_meters, drive_distance_to_next_event_meters')
    .eq('couple_id', coupleId)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (!events || events.length === 0) return

  const updates: {
    id: string
    drive_time_from_home_seconds: number | null
    drive_time_to_next_event_seconds: number | null
    drive_distance_from_home_meters: number | null
    drive_distance_to_next_event_meters: number | null
  }[] = []

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    let fromHome: number | null = null
    let toNext: number | null = null
    let fromHomeMeters: number | null = null
    let toNextMeters: number | null = null

    if (ev.venue_lat && ev.venue_lng) {
      if (homeLat && homeLng) {
        try {
          const r = await fetch(`/api/drive-time?origin_lat=${homeLat}&origin_lng=${homeLng}&dest_lat=${ev.venue_lat}&dest_lng=${ev.venue_lng}`)
          const d = await r.json()
          if (typeof d.duration_seconds === 'number') fromHome = d.duration_seconds
          if (typeof d.distance_meters === 'number') fromHomeMeters = d.distance_meters
        } catch { /* best-effort */ }
      }

      const next = events[i + 1]
      if (next?.venue_lat && next?.venue_lng) {
        try {
          const r = await fetch(`/api/drive-time?origin_lat=${ev.venue_lat}&origin_lng=${ev.venue_lng}&dest_lat=${next.venue_lat}&dest_lng=${next.venue_lng}`)
          const d = await r.json()
          if (typeof d.duration_seconds === 'number') toNext = d.duration_seconds
          if (typeof d.distance_meters === 'number') toNextMeters = d.distance_meters
        } catch { /* best-effort */ }
      }
    }

    updates.push({
      id: ev.id,
      drive_time_from_home_seconds: fromHome,
      drive_time_to_next_event_seconds: toNext,
      drive_distance_from_home_meters: fromHomeMeters,
      drive_distance_to_next_event_meters: toNextMeters,
    })
  }

  await Promise.all(
    updates.map((u) =>
      supabase
        .from('events')
        .update({
          drive_time_from_home_seconds: u.drive_time_from_home_seconds,
          drive_time_to_next_event_seconds: u.drive_time_to_next_event_seconds,
          drive_distance_from_home_meters: u.drive_distance_from_home_meters,
          drive_distance_to_next_event_meters: u.drive_distance_to_next_event_meters,
        })
        .eq('id', u.id)
    )
  )

  queryClient.invalidateQueries({ queryKey: ['couple-events', coupleId] })
}

/**
 * Formats a drive duration for the compact event meta line.
 *
 * Rounds to whole minutes first, then splits into hours + minutes so long
 * drives read as `~1h 34m` rather than `~94 min`. The minutes part is dropped
 * when it rounds to zero (`~2h`), and the hours part is omitted under an hour
 * (`~45m`).
 *
 * @param seconds - Drive duration in seconds, as returned by `/api/drive-time`.
 * @returns An approximate, human-readable duration (e.g. `~1h 34m`).
 */
function formatDriveTime(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `~${minutes}m`
  return minutes === 0 ? `~${hours}h` : `~${hours}h ${minutes}m`
}

function formatDriveDistance(meters: number): string {
  const km = meters / 1000
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
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

export function CoupleEvents({ couple, onLoadingChange, ref }: CoupleEventsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()
  const [editingVendorIds, setEditingVendorIds] = useState<string[]>([])
  const [calculatingDriveTime, setCalculatingDriveTime] = useState(false)

  const openAdd = () => {
    setEditingEvent(undefined)
    setEditingVendorIds([])
    setShowModal(true)
  }
  useImperativeHandle(ref, () => ({ openAdd }), [])

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

      // Let the row type infer from the typed query (the manual annotation
      // shadowed the generated events Row); final shape cast below.
      return (data || []).map((row) => {
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
      const created = unwrap(
        await createEventAction({
          couple_id: rest.couple_id,
          date: rest.date,
          title: rest.title ?? null,
          venue: rest.venue,
          venue_phone: rest.venue_phone ?? null,
          venue_website: rest.venue_website ?? null,
          venue_lat: rest.venue_lat ?? null,
          venue_lng: rest.venue_lng ?? null,
          timeline_notes: rest.timeline_notes ?? '',
          status: rest.status,
        }),
      )
      // Re-fetch the full event row so downstream side-effects can
      // read the auto-generated columns the action only returned the
      // id for (share_token, created_at, etc.). The action is the
      // authority for the write; this read uses RLS.
      const { data: fullRow } = await supabase
        .from('events')
        .select('*')
        .eq('id', created.id)
        .single()
      const newEvent = fullRow as Event | null

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
        unwrap(
          await bulkLinkContactsToEventAction({
            event_id: newEvent.id,
            contact_ids: allContactIds,
          }),
        )
        // Anyone attached to a couple's event also belongs in the
        // couple's Contacts tab - otherwise vendors added during
        // event creation appear nowhere on the couple profile.
        // Upsert is idempotent so re-attaching to a second event
        // is harmless.
        await supabase
          .from('couple_contacts')
          .upsert(
            allContactIds.map((contact_id) => ({
              couple_id: couple.id,
              contact_id,
              user_id: user.user.id,
            })),
            { onConflict: 'couple_id,contact_id', ignoreDuplicates: true },
          )
      }

      // Auto-insert sunset timeline item if we have coordinates.
      // Best-effort: API failures don't fail the event creation.
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
            // Don't fail the whole flow if the action rejects - sunset
            // is a "would be nice" detail, not core data.
            await createTimelineItemAction({
              event_id: newEvent.id,
              title: 'Sunset',
              start_time: localTime,
              duration_min: 30,
              position: 1000,
              pending_review: false,
              // MC-only planning cue (golden-hour photos). Kept off the
              // couple portal and vendor run sheet.
              internal: true,
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
      const { vendorIds, ...rest } = eventData
      unwrap(
        await updateEventAction({
          id: rest.id,
          couple_id: rest.couple_id,
          date: rest.date,
          title: rest.title ?? null,
          venue: rest.venue,
          venue_phone: rest.venue_phone ?? null,
          venue_website: rest.venue_website ?? null,
          venue_lat: rest.venue_lat ?? null,
          venue_lng: rest.venue_lng ?? null,
          timeline_notes: rest.timeline_notes ?? '',
          status: rest.status,
        }),
      )

      // Sync contacts if provided. Wipe-and-rewrite - `event_contacts`
      // is a join table without natural ordering, so it's cheaper to
      // delete-then-insert than to diff. Done with the RLS-scoped
      // client because the action set doesn't expose "delete all
      // links for event X" (most flows want per-pair unlink, which
      // the action covers).
      if (vendorIds !== undefined) {
        await supabase
          .from('event_contacts')
          .delete()
          .eq('event_id', rest.id)
        if (vendorIds.length > 0) {
          unwrap(
            await bulkLinkContactsToEventAction({
              event_id: rest.id,
              contact_ids: vendorIds,
            }),
          )
          // Mirror the create flow: surface event vendors on the
          // couple's Contacts tab. We never *remove* couple_contacts
          // here - a vendor attached to one event still belongs to
          // the couple even if dropped from another.
          const { data: userData } = await supabase.auth.getUser()
          if (userData.user) {
            await supabase
              .from('couple_contacts')
              .upsert(
                vendorIds.map((contact_id) => ({
                  couple_id: couple.id,
                  contact_id,
                  user_id: userData.user!.id,
                })),
                {
                  onConflict: 'couple_id,contact_id',
                  ignoreDuplicates: true,
                },
              )
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['couple-events', couple.id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', couple.id] })
      if (editingEvent) {
        queryClient.invalidateQueries({ queryKey: ['event-contacts', editingEvent.id] })
      }

      const routeChanged = !editingEvent
        || editingEvent.date !== variables.date
        || editingEvent.venue_lat !== variables.venue_lat
        || editingEvent.venue_lng !== variables.venue_lng
      const previousDate = editingEvent?.date

      setShowModal(false)
      setEditingEvent(undefined)
      toast('Event updated')

      if (routeChanged) {
        const datesToRecalc = new Set<string>()
        if (variables?.date) datesToRecalc.add(variables.date)
        if (previousDate && previousDate !== variables?.date) datesToRecalc.add(previousDate)
        if (datesToRecalc.size > 0) {
          setCalculatingDriveTime(true)
          Promise.all(
            Array.from(datesToRecalc).map((d) => recalculateDriveTimes(couple.id, d, queryClient))
          ).finally(() => setCalculatingDriveTime(false))
        }
      }
    },
    onError: () => toast('Failed to update event'),
  })

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      // Fetch date before deleting so we can recalculate afterwards.
      // RLS-scoped client; the delete itself goes through the action.
      const { data: toDelete } = await supabase
        .from('events')
        .select('date')
        .eq('id', eventId)
        .single()

      unwrap(await deleteEventAction(eventId))

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
        {/* Section label — the add action lives in the Overview header (top right). */}
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-900">Events</h3>

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
                      ? event.drive_distance_from_home_meters != null
                        ? `${formatDriveTime(event.drive_time_from_home_seconds)} · ${formatDriveDistance(event.drive_distance_from_home_meters)} from home`
                        : `${formatDriveTime(event.drive_time_from_home_seconds)} from home`
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
                          <p className="text-sm text-gray-700 truncate">
                            {event.title || event.venue || 'Untitled'}
                            {event.title && event.venue && (
                              <span className="text-gray-400"> · {event.venue}</span>
                            )}
                          </p>
                          <Pencil size={11} strokeWidth={1.5} className="text-gray-400 opacity-0 group-hover:opacity-60 shrink-0 ml-2" />
                        </div>
                        {calculatingDriveTime ? (
                          <p className="text-xs text-gray-300 mt-0.5">Calculating...</p>
                        ) : meta ? (
                          <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
                        ) : null}
                      </div>
                      {event.drive_time_to_next_event_seconds != null && idx < group.length - 1 && (
                        <p className="text-xs text-gray-400 pl-6 py-1.5">
                          → {formatDriveTime(event.drive_time_to_next_event_seconds)}
                          {event.drive_distance_to_next_event_meters != null ? ` · ${formatDriveDistance(event.drive_distance_to_next_event_meters)}` : ''} drive
                        </p>
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
        coupleName={couple.name}
        // Default a new event to the couple's first existing event
        // date (couples regularly need ceremony + reception on the
        // same day) or fall back to next Saturday inside the modal.
        defaultDate={events?.[0]?.date ?? couple.event_date ?? undefined}
        loading={loading}
        initialVendorIds={editingVendorIds}
      />

    </>
  )
}
