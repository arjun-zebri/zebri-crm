'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, X, Phone, Globe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import * as Popover from '@radix-ui/react-popover'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { Event, EventStatus, STATUS_LABELS } from '../events/events-types'
import { CATEGORY_LABELS } from '../contacts/contacts-types'
import { createClient } from '@/lib/supabase/client'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string; vendorIds?: string[] }) => void
  onDelete?: () => void | Promise<void>
  event?: Event
  coupleId: string
  loading: boolean
  initialVendorIds?: string[]
}

interface VendorOption {
  id: string
  name: string
  category: string
}

interface PlaceSuggestion {
  placeId: string
  mainText: string
  secondaryText: string
}

const EVENT_STATUSES: EventStatus[] = ['upcoming', 'completed', 'cancelled']

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  coupleId,
  loading,
  initialVendorIds,
}: EventModalProps) {
  const supabase = createClient()
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [venuePhone, setVenuePhone] = useState<string | null>(null)
  const [venueWebsite, setVenueWebsite] = useState<string | null>(null)
  const [venueLat, setVenueLat] = useState<number | null>(null)
  const [venueLng, setVenueLng] = useState<number | null>(null)
  const [venueSuggestions, setVenueSuggestions] = useState<PlaceSuggestion[]>([])
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const status_state = useState<EventStatus>('upcoming')
  const [status, setStatus] = status_state
  const [notes, setNotes] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [vendorSearch, setVendorSearch] = useState('')

  const { data: allVendors } = useQuery({
    queryKey: ['all-contacts'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, category')
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
      setDate(event.date)
      setVenue(event.venue)
      setVenuePhone(event.venue_phone ?? null)
      setVenueWebsite(event.venue_website ?? null)
      setVenueLat(event.venue_lat ?? null)
      setVenueLng(event.venue_lng ?? null)
      setStatus(event.status)
      setNotes(event.timeline_notes ?? '')
    } else {
      resetForm()
    }
    setSelectedVendorIds(initialVendorIds || [])
    setShowDeleteModal(false)
    setVendorSearch('')
    setVenueSuggestions([])
    setVenueDropdownOpen(false)
  }, [event, isOpen, initialVendorIds])

  const resetForm = () => {
    setDate('')
    setVenue('')
    setVenuePhone(null)
    setVenueWebsite(null)
    setVenueLat(null)
    setVenueLng(null)
    setStatus('upcoming')
    setNotes('')
    setSelectedVendorIds([])
    setVendorSearch('')
    setVenueSuggestions([])
    setVenueDropdownOpen(false)
  }

  const handleVenueChange = (value: string) => {
    setVenue(value)
    // Clear place details when user types manually
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
      // Silently skip — venue name is set, details are just a bonus
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date.trim()) return

    onSave({
      id: event?.id,
      couple_id: coupleId,
      date,
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

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (onDelete) {
      await onDelete()
    }
    setShowDeleteModal(false)
  }

  const filteredVendors = useMemo(() => {
    if (!allVendors) return []
    return allVendors.filter(
      (v) =>
        !selectedVendorIds.includes(v.id) &&
        v.name.toLowerCase().includes(vendorSearch.toLowerCase())
    )
  }, [allVendors, vendorSearch, selectedVendorIds])

  const selectedVendors = useMemo(() => {
    if (!allVendors) return []
    return allVendors.filter((v) => selectedVendorIds.includes(v.id))
  }, [allVendors, selectedVendorIds])

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? 'Edit Event' : 'Add Event'}
      footer={
        <div className="flex items-center justify-between">
          {event && onDelete && (
            <button
              onClick={handleDeleteClick}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
            >
              Delete
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !date.trim()}
              className="text-sm px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <DatePicker value={date} onChange={setDate} placeholder="Select date" />
          </div>

          {/* Venue - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <div className="relative">
              <input
                type="text"
                value={venue}
                onChange={(e) => handleVenueChange(e.target.value)}
                onBlur={() => setTimeout(() => setVenueDropdownOpen(false), 150)}
                placeholder="e.g., Grand Hotel Ballroom"
                className={inputClass}
                autoComplete="off"
              />
              {venueDropdownOpen && venueSuggestions.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  {venueSuggestions.map((s) => (
                    <button
                      key={s.placeId}
                      type="button"
                      onMouseDown={() => handleVenueSelect(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <p className="text-sm font-medium text-gray-900">{s.mainText}</p>
                      {s.secondaryText && (
                        <p className="text-xs text-gray-500">{s.secondaryText}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(venuePhone || venueWebsite) && (
              <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 flex flex-col gap-1.5">
                {venuePhone && (
                  <div className="flex items-center gap-2">
                    <Phone size={11} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-600">{venuePhone}</span>
                  </div>
                )}
                {venueWebsite && (
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe size={11} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                    <a
                      href={venueWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-600 hover:text-gray-900 underline truncate"
                    >
                      {venueWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={inputClass + ' flex items-center justify-between'}
                >
                  {STATUS_LABELS[status]}
                  <ChevronDown size={16} strokeWidth={1.5} className="text-gray-400" />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className="z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1"
                side="bottom"
                align="start"
              >
                {EVENT_STATUSES.map((stat) => (
                  <button
                    key={stat}
                    type="button"
                    onClick={() => {
                      setStatus(stat)
                      setStatusOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition ${
                      status === stat
                        ? 'bg-green-50 text-green-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {STATUS_LABELS[stat]}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Root>
          </div>

          {/* Contacts - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contacts
            </label>

            {/* Selected vendors */}
            {selectedVendors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedVendors.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-sm text-gray-700"
                  >
                    {v.name}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedVendorIds((ids) => ids.filter((id) => id !== v.id))
                      }
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <X size={12} strokeWidth={1.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Vendor search */}
            <div className="relative">
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Search contacts to add..."
                className={inputClass}
              />
              {vendorSearch && filteredVendors.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredVendors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVendorIds((ids) => [...ids, v.id])
                        setVendorSearch('')
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <p className="text-sm font-medium text-gray-900">{v.name}</p>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABELS[v.category as keyof typeof CATEGORY_LABELS] || v.category}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {vendorSearch && filteredVendors.length === 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3">
                  <p className="text-sm text-gray-500 text-center">No contacts found</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Timeline, ceremony details, vendor notes..."
              rows={8}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </form>
    </Modal>

    {/* Delete Confirmation Modal - Outside Modal to appear on top */}
    {showDeleteModal && (
      <>
        <div className="fixed inset-0 bg-black/20 z-[70]" onClick={() => setShowDeleteModal(false)} />
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4">
            <div className="px-6 py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Event</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this event? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
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
