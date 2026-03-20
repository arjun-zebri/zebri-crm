'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import * as Popover from '@radix-ui/react-popover'
import { Modal } from '@/components/ui/modal'
import { Event, EventStatus, STATUS_LABELS } from '../events/events-types'
import { CATEGORY_LABELS } from '../vendors/vendors-types'
import { createClient } from '@/lib/supabase/client'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<Event, 'id' | 'user_id' | 'created_at'> & { id?: string; vendorIds?: string[] }) => void
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

const EVENT_STATUSES: EventStatus[] = ['upcoming', 'completed', 'cancelled']

export function EventModal({
  isOpen,
  onClose,
  onSave,
  event,
  coupleId,
  loading,
  initialVendorIds,
}: EventModalProps) {
  const supabase = createClient()
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [status, setStatus] = useState<EventStatus>('upcoming')
  const [notes, setNotes] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [vendorSearch, setVendorSearch] = useState('')

  const { data: allVendors } = useQuery({
    queryKey: ['all-vendors'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('vendors')
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
      setStatus(event.status)
      setNotes(event.timeline_notes)
    } else {
      resetForm()
    }
    setSelectedVendorIds(initialVendorIds || [])
    setDeleteConfirm(false)
    setVendorSearch('')
  }, [event, isOpen, initialVendorIds])

  const resetForm = () => {
    setDate('')
    setVenue('')
    setStatus('upcoming')
    setNotes('')
    setSelectedVendorIds([])
    setVendorSearch('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date.trim()) return

    onSave({
      id: event?.id,
      couple_id: coupleId,
      date,
      venue,
      status,
      timeline_notes: notes,
      vendorIds: selectedVendorIds,
    })

    resetForm()
  }

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 3000)
    }
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? 'Edit Event' : 'Add Event'}
      footer={
        <div className="flex items-center justify-between">
          {event && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className={`text-sm px-4 py-2 rounded-xl transition cursor-pointer ${
                deleteConfirm
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              {deleteConfirm ? 'Click again to confirm' : 'Delete'}
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
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Venue - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g., Grand Hotel Ballroom"
              className={inputClass}
            />
          </div>

          {/* Status - 1 col */}
          <div>
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

          {/* Vendors - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendors
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
                placeholder="Search vendors to add..."
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
                  <p className="text-sm text-gray-500 text-center">No vendors found</p>
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
  )
}
