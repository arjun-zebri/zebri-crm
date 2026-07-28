'use client'

import { Check, Loader2, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { applyCase, cssTextTransform } from '@/lib/branding/text-case'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'
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
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Portal Overview tab: editable contact details for both partners and a
 * timeline of the couple's events.
 *
 * Either partner can edit both triples (no privacy boundary on contact
 * info - vow privacy is handled separately). Each field commits on blur;
 * we persist the whole couple-details set in one RPC call and surface a
 * lightweight Saving / Saved / error affordance. Borderless throughout to
 * match the couple-modal Overview.
 */
export function OverviewSection({ token, primary, secondary, events, branding }: OverviewSectionProps) {
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

  const labelDefaults = roleDefaults(branding, 'sectionLabel')
  const labelColor = labelDefaults.color

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3
            style={{
              fontSize: `${labelDefaults.fontSize}px`,
              color: labelColor,
              fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
              fontWeight: labelDefaults.fontWeight,
              lineHeight: labelDefaults.lineHeight,
              letterSpacing: `${labelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(labelDefaults.textTransform),
            }}
          >
            {applyCase('Your details', labelDefaults.textTransform)}
          </h3>
          <SaveIndicator status={status} branding={branding} />
        </div>
        <div className="space-y-4">
          <ContactDetailsCard label="Primary contact" value={primaryTriple} onSave={savePrimary} branding={branding} />
          <ContactDetailsCard label="Secondary contact" value={secondaryTriple} onSave={saveSecondary} branding={branding} />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={openAddEvent}
          className="group flex items-center gap-1.5 mb-4 cursor-pointer"
        >
          <h3
            className="group-hover:opacity-75 transition"
            style={{
              fontSize: `${labelDefaults.fontSize}px`,
              color: labelColor,
              fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
              fontWeight: labelDefaults.fontWeight,
              lineHeight: labelDefaults.lineHeight,
              letterSpacing: `${labelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(labelDefaults.textTransform),
            }}
          >
            {applyCase('Events', labelDefaults.textTransform)}
          </h3>
          <Plus size={13} strokeWidth={1.5} style={{ color: labelColor }} className="group-hover:opacity-75 transition" />
        </button>
        <EventsList events={eventList} onAdd={openAddEvent} onEdit={openEditEvent} branding={branding} />
      </div>

      {eventModalOpen && (
        <PortalEventModal
          key={editingEvent?.id ?? 'new'}
          onClose={() => { setEventModalOpen(false); setEditingEvent(null) }}
          onSave={handleSaveEvent}
          event={editingEvent}
          saving={savingEvent}
          branding={branding}
        />
      )}
    </div>
  )
}

/** Inline Saving / Saved / error affordance beside the details heading. */
function SaveIndicator({ status, branding }: { status: SaveStatus; branding: PublicBranding }) {
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  if (status === 'saving') {
    return (
      <span
        className="flex items-center gap-1.5"
        style={{
          fontSize: `${finePrintDefaults.fontSize}px`,
          color: finePrintDefaults.color,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
          lineHeight: finePrintDefaults.lineHeight,
        }}
      >
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
        Saving...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span
        className="flex items-center gap-1.5"
        style={{
          fontSize: `${finePrintDefaults.fontSize}px`,
          color: STATUS_COLORS.success,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
          lineHeight: finePrintDefaults.lineHeight,
        }}
      >
        <Check size={13} strokeWidth={1.5} />
        Saved
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span
        style={{
          fontSize: `${finePrintDefaults.fontSize}px`,
          color: STATUS_COLORS.error,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
          lineHeight: finePrintDefaults.lineHeight,
        }}
      >
        Couldn&apos;t save - try again
      </span>
    )
  }
  return null
}
