'use client'

import { Check, Loader2, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import { ContactDetailsCard, type ContactTriple } from './contact-details-card'
import { EventsList } from './overview-events'
import { PortalEvent } from './page'
import { PortalEventModal } from './portal-event-modal'

interface OverviewSectionProps {
  token: string
  /** Persisted primary partner contact triple. */
  primary: ContactTriple
  /** Persisted secondary partner contact triple. */
  secondary: ContactTriple
  events: PortalEvent[]
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Portal Overview tab: editable contact details for both partners and a
 * timeline of the couple's events.
 *
 * Either partner can edit both triples (no privacy boundary on contact
 * info — vow privacy is handled separately). Each field commits on blur;
 * we persist the whole couple-details set in one RPC call and surface a
 * lightweight Saving / Saved / error affordance. Borderless throughout to
 * match the couple-modal Overview.
 */
export function OverviewSection({ token, primary, secondary, events }: OverviewSectionProps) {
  const supabase = createClient()
  const [primaryTriple, setPrimaryTriple] = useState<ContactTriple>(primary)
  const [secondaryTriple, setSecondaryTriple] = useState<ContactTriple>(secondary)
  const [status, setStatus] = useState<SaveStatus>('idle')

  // Editable events: local copy so add/edit reflect immediately.
  const [eventList, setEventList] = useState<PortalEvent[]>(events)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<PortalEvent | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)

  const save = useCallback(
    async (next: { primary: ContactTriple; secondary: ContactTriple }) => {
      setStatus('saving')
      const { error } = await supabase.rpc('save_portal_couple_details', {
        p_token: token,
        p_primary_name: next.primary.name,
        p_primary_email: next.primary.email,
        p_primary_phone: next.primary.phone,
        p_secondary_name: next.secondary.name,
        p_secondary_email: next.secondary.email,
        p_secondary_phone: next.secondary.phone,
      })
      setStatus(error ? 'error' : 'saved')
    },
    [supabase, token],
  )

  const savePrimary = (t: ContactTriple) => {
    setPrimaryTriple(t)
    void save({ primary: t, secondary: secondaryTriple })
  }
  const saveSecondary = (t: ContactTriple) => {
    setSecondaryTriple(t)
    void save({ primary: primaryTriple, secondary: t })
  }

  const openAddEvent = () => {
    setEditingEvent(null)
    setEventModalOpen(true)
  }
  const openEditEvent = (event: PortalEvent) => {
    setEditingEvent(event)
    setEventModalOpen(true)
  }

  const handleSaveEvent = async ({ date, venue }: { date: string; venue: string }) => {
    setSavingEvent(true)
    const id = editingEvent?.id ?? crypto.randomUUID()
    const { data, error } = await supabase.rpc('save_portal_event', {
      p_token: token,
      p_id: id,
      p_date: date,
      p_venue: venue,
    })
    if (!error) {
      const saved: PortalEvent = {
        id: (data as string | null) ?? id,
        date,
        venue: venue.trim() || null,
        status: editingEvent?.status ?? 'upcoming',
      }
      setEventList((prev) =>
        [...prev.filter((e) => e.id !== saved.id), saved].sort((a, b) => a.date.localeCompare(b.date)),
      )
    }
    setSavingEvent(false)
    setEventModalOpen(false)
    setEditingEvent(null)
  }

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-caption font-semibold uppercase tracking-wider text-text">Your details</h3>
          <SaveIndicator status={status} />
        </div>
        <div className="space-y-4">
          <ContactDetailsCard label="Primary contact" value={primaryTriple} onSave={savePrimary} />
          <ContactDetailsCard label="Secondary contact" value={secondaryTriple} onSave={saveSecondary} />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={openAddEvent}
          className="group flex items-center gap-1.5 mb-4 cursor-pointer"
        >
          <h3 className="text-caption font-semibold uppercase tracking-wider text-text group-hover:text-text-muted transition">Events</h3>
          <Plus size={13} strokeWidth={2} className="text-text group-hover:text-text-muted transition" />
        </button>
        <EventsList events={eventList} onAdd={openAddEvent} onEdit={openEditEvent} />
      </div>

      {eventModalOpen && (
        <PortalEventModal
          key={editingEvent?.id ?? 'new'}
          onClose={() => { setEventModalOpen(false); setEditingEvent(null) }}
          onSave={handleSaveEvent}
          event={editingEvent}
          saving={savingEvent}
        />
      )}
    </div>
  )
}

/** Inline Saving / Saved / error affordance beside the details heading. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-caption text-text-subtle">
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
        Saving…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-caption text-success">
        <Check size={13} strokeWidth={1.5} />
        Saved
      </span>
    )
  }
  if (status === 'error') {
    return <span className="text-caption text-danger">Couldn’t save — try again</span>
  }
  return null
}
