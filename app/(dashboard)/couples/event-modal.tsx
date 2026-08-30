'use client'

import * as Popover from '@radix-ui/react-popover'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Globe, Phone, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/types/contact'
import { Event, EventStatus, STATUS_LABELS } from '@/types/event'

import { ContactPopover } from './contact-popover'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string; vendorIds?: string[] }) => void
  onDelete?: () => void | Promise<void>
  event?: Event
  coupleId: string
  /** Shown in the modal header ("Add event for {coupleName}") so the
   *  user always knows which couple they're editing - matters when
   *  the modal is opened from search results or cross-couple views. */
  coupleName?: string
  /** Pre-fill the date for new events. Caller can pass the couple's
   *  existing wedding date so a second event on the same day starts
   *  on the right date. Falls back to next Saturday. */
  defaultDate?: string
  loading: boolean
  initialVendorIds?: string[]
}

interface VendorOption {
  id: string
  name: string
  category: string
  created_at: string
}

interface PlaceSuggestion {
  placeId: string
  mainText: string
  secondaryText: string
}

const EVENT_STATUSES: EventStatus[] = ['upcoming', 'completed', 'cancelled']

// Most weddings are weekends - defaulting the date input to the next
// Saturday saves a few clicks in the calendar for the common case.
function nextSaturday(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const dow = d.getDay()
  const offset = ((6 - dow + 7) % 7) || 7
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// The `Input` primitive's own classes, inlined because these fields are
// raw `<input>` elements with bespoke labels. The underline vocabulary
// this modal used until 2026-08-07 was dropped when `DatePicker` lost its
// `underline` variant: a boxed 32px date field among 37px underlined
// text fields read as a different form entirely.
const inputClass =
  'block h-8 w-full rounded-control border border-border bg-surface px-2.5 text-body text-text placeholder:text-text-subtle transition-colors focus-visible:border-brand-fg focus-visible:outline-none'

// Same chrome, minus the fixed control height: a textarea sizes to its
// `rows`, so `h-8` would crush it to a single line.
const textareaClass = `${inputClass} h-auto py-1.5 resize-none`

const labelClass = 'block text-body text-gray-600 mb-1'

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  coupleId,
  coupleName,
  defaultDate,
  loading,
  initialVendorIds,
}: EventModalProps) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [venue, setVenue] = useState('')
  const [venuePhone, setVenuePhone] = useState<string | null>(null)
  const [venueWebsite, setVenueWebsite] = useState<string | null>(null)
  const [venueLat, setVenueLat] = useState<number | null>(null)
  const [venueLng, setVenueLng] = useState<number | null>(null)
  const [venueSuggestions, setVenueSuggestions] = useState<PlaceSuggestion[]>([])
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<EventStatus>('upcoming')
  const [notes, setNotes] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])

  const { data: allVendors } = useQuery({
    queryKey: ['all-contacts'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      // Select the union of fields any `['all-contacts']` consumer
      // needs (ContactPicker also reads `created_at` to compute its
      // Recent list) - the cache is shared across pickers, so a
      // narrower select here would mean ContactPicker reads
      // undefined for fields it sorts on.
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, category, created_at')
        .eq('user_id', user.user.id)
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (error) throw error
      return (data || []) as VendorOption[]
    },
    enabled: isOpen,
  })

  useEffect(() => {
    if (event) {
      setTitle(event.title ?? '')
      setDate(event.date)
      setVenue(event.venue)
      setVenuePhone(event.venue_phone ?? null)
      setVenueWebsite(event.venue_website ?? null)
      setVenueLat(event.venue_lat ?? null)
      setVenueLng(event.venue_lng ?? null)
      setStatus(event.status)
      setNotes(event.timeline_notes ?? '')
    } else {
      setTitle('')
      // New events leave the date empty - the user picks it
      // explicitly. The calendar still opens at `defaultDate`
      // (the couple's existing event date, falling back to the
      // next Saturday) so the picker lands on the right month.
      setDate('')
      setVenue('')
      setVenuePhone(null)
      setVenueWebsite(null)
      setVenueLat(null)
      setVenueLng(null)
      setStatus('upcoming')
      setNotes('')
    }
    setDateError(null)
    setSelectedVendorIds(initialVendorIds || [])
    setShowDeleteModal(false)
    setVenueSuggestions([])
    setVenueDropdownOpen(false)
  }, [event, isOpen, initialVendorIds, defaultDate])

  const handleVenueChange = (value: string) => {
    setVenue(value)
    // Clear place details when the user edits manually so we don't
    // keep stale phone/website hints from a previous suggestion.
    setVenuePhone(null)
    setVenueWebsite(null)
    setVenueLat(null)
    setVenueLng(null)

    if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current)

    if (value.trim().length < 2) {
      setVenueSuggestions([])
      setVenueDropdownOpen(false)
      return
    }

    venueDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`)
        const data = await res.json()
        const suggestions: PlaceSuggestion[] = (data.suggestions || []).map((s: {
          placePrediction: {
            placeId: string
            structuredFormat: { mainText: { text: string }; secondaryText: { text: string } }
          }
        }) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.structuredFormat.mainText.text,
          secondaryText: s.placePrediction.structuredFormat.secondaryText?.text ?? '',
        }))
        setVenueSuggestions(suggestions)
        setVenueDropdownOpen(suggestions.length > 0)
      } catch {
        setVenueSuggestions([])
        setVenueDropdownOpen(false)
      }
    }, 300)
  }

  const handleVenueSelect = async (suggestion: PlaceSuggestion) => {
    setVenue(suggestion.mainText)
    setVenueSuggestions([])
    setVenueDropdownOpen(false)

    try {
      const res = await fetch(`/api/places/details?place_id=${suggestion.placeId}`)
      const data = await res.json()
      setVenuePhone(data.nationalPhoneNumber ?? null)
      setVenueWebsite(data.websiteUri ?? null)
      setVenueLat(data.location?.latitude ?? null)
      setVenueLng(data.location?.longitude ?? null)
    } catch {
      // Silently skip - venue name is set, details are just a bonus
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Date is the only required field — title is optional (an event is
    // identified by its date + venue when left blank).
    if (!date.trim()) {
      setDateError('Date is required')
      return
    }
    setDateError(null)

    onSave({
      ...(event?.id ? { id: event.id } : {}),
      couple_id: coupleId,
      date,
      title: title.trim() || null,
      venue,
      venue_phone: venuePhone,
      venue_website: venueWebsite,
      venue_lat: venueLat,
      venue_lng: venueLng,
      status,
      timeline_notes: notes,
      vendorIds: selectedVendorIds,
    })
  }

  const handleConfirmDelete = async () => {
    if (onDelete) await onDelete()
    setShowDeleteModal(false)
  }

  const selectedVendors = useMemo(() => {
    if (!allVendors) return []
    return allVendors.filter((v) => selectedVendorIds.includes(v.id))
  }, [allVendors, selectedVendorIds])

  // Header title: anchor to the couple so the modal never feels
  // detached from the row it edits. Falls back to a generic label
  // when callers haven't passed the couple name yet.
  const headerTitle = event
    ? 'Edit event'
    : coupleName
    ? `Add event for ${coupleName}`
    : 'Add event'

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={headerTitle}
        footer={
          <div className="flex items-center justify-between">
            {event && onDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={loading}
                className="text-body px-4 py-2 rounded-control bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
              >
                Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={onClose}
                disabled={loading}
                className="text-body px-3 py-1.5 rounded-control bg-surface-emphasis text-text hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <Button onClick={handleSubmit} disabled={!date.trim()} loading={loading}>
                Save
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title - optional short label distinguishing ceremony
              / reception / engagement party. Goes first because it's
              the line users will see in the events list. */}
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Ceremony"
              className={inputClass}
            />
          </div>

          {/* Date + Status share a row - both compact controls. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={date}
                onChange={(v) => {
                  setDate(v)
                  setDateError(null)
                }}
                placeholder="Select date"
                defaultViewDate={defaultDate ?? nextSaturday()}
              />
              {dateError && (
                <p className="text-body text-red-500 mt-1">{dateError}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className={`${inputClass} flex items-center justify-between text-left`}
                  >
                    <span className="text-text">{STATUS_LABELS[status]}</span>
                    <ChevronDown size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    // `z-[90]`, the popover tier. At `z-[70]` this rendered
                    // behind the modal: opened from inside the couple profile
                    // overlay, Modal auto-tiers to `nested`, whose panel is
                    // `z-[80]`. The dropdown was in the DOM and invisible.
                    className="bg-surface border border-border rounded-control shadow-lg py-1 z-[90] w-[var(--radix-popover-trigger-width)]"
                    sideOffset={4}
                    align="start"
                  >
                    {EVENT_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setStatus(s)
                          setStatusOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-body transition ${
                          status === s
                            ? 'bg-surface-emphasis text-text font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>

          {/* Venue - full width with Places autocomplete suggestions. */}
          <div>
            <label className={labelClass}>Venue</label>
            <div className="relative">
              <input
                type="text"
                value={venue}
                onChange={(e) => handleVenueChange(e.target.value)}
                onBlur={() => setTimeout(() => setVenueDropdownOpen(false), 150)}
                placeholder="Search a venue or address"
                className={inputClass}
                autoComplete="off"
              />
              {venueDropdownOpen && venueSuggestions.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-border rounded-control shadow-lg z-50 max-h-48 overflow-y-auto">
                  {venueSuggestions.map((s) => (
                    <button
                      key={s.placeId}
                      type="button"
                      onMouseDown={() => handleVenueSelect(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <p className="text-body font-medium text-text">{s.mainText}</p>
                      {s.secondaryText && (
                        <p className="text-body text-text-muted">{s.secondaryText}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(venuePhone || venueWebsite) && (
              <div className="mt-2 flex flex-col gap-1.5">
                {venuePhone && (
                  <div className="flex items-center gap-2">
                    <Phone size={11} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                    <span className="text-body text-gray-600">{venuePhone}</span>
                  </div>
                )}
                {venueWebsite && (
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe size={11} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                    <a
                      href={venueWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body text-gray-600 hover:text-text underline truncate"
                    >
                      {venueWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contacts - header-style "Contacts +" trigger opens a
              search popover; the popover's footer "Create new contact"
              opens the full ContactModal for proper detail capture. */}
          <div>
            <ContactPopover
              excludeIds={selectedVendorIds}
              onAdd={(id) =>
                setSelectedVendorIds((ids) =>
                  ids.includes(id) ? ids : [...ids, id],
                )
              }
            >
              <button
                type="button"
                className="group flex items-center gap-1.5 mb-2 cursor-pointer"
              >
                <span className="text-body text-gray-600 group-hover:text-text transition">
                  Vendor Contacts
                </span>
                <Plus
                  size={12}
                  strokeWidth={2}
                  className="text-gray-600 group-hover:text-text transition"
                />
              </button>
            </ContactPopover>
            {selectedVendors.length === 0 ? (
              <p className="text-body text-text-subtle">No contacts added</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedVendors.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-surface-emphasis rounded-control text-body text-gray-700"
                  >
                    <span className="truncate max-w-[12rem]">{v.name}</span>
                    <span className="text-body text-text-subtle">
                      {CATEGORY_LABELS[v.category as keyof typeof CATEGORY_LABELS] || v.category}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedVendorIds((ids) => ids.filter((id) => id !== v.id))
                      }
                      className="text-text-subtle hover:text-gray-600 transition cursor-pointer ml-0.5"
                      aria-label={`Remove ${v.name}`}
                    >
                      <X size={12} strokeWidth={1.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Timeline, ceremony details, vendor notes..."
              rows={8}
              className={textareaClass}
            />
          </div>
        </form>
      </Modal>

      {showDeleteModal && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[70]" onClick={() => setShowDeleteModal(false)} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center">
            <div className="bg-surface rounded-control shadow-xl max-w-sm w-full mx-4">
              <div className="px-6 py-6">
                <h3 className="text-lg font-semibold text-text mb-2">Delete Event</h3>
                <p className="text-body text-gray-600 mb-6">
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-body border border-border rounded-control hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <Button variant="danger" onClick={handleConfirmDelete} loading={loading} className="flex-1">
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
