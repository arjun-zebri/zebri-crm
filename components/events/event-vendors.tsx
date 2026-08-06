'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'

import { ContactPopover } from '@/app/(dashboard)/couples/contact-popover'
import {
  linkContactToEventAction,
  unlinkContactFromEventAction,
} from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/types/contact'

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}

interface EventVendorsProps {
  eventId: string
}

interface ContactLink {
  id: string
  contact_id: string
  vendor: {
    id: string
    name: string
    category: string
    status: string
  }
}

export function EventVendors({ eventId }: EventVendorsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['event-contacts', eventId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('event_contacts')
        .select('id, contact_id, vendor:contact_id(id, name, category, status)')
        .eq('event_id', eventId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as ContactLink[]
    },
  })

  const removeVendor = useMutation({
    mutationFn: async (contactId: string) => {
      unwrap(
        await unlinkContactFromEventAction({
          event_id: eventId,
          contact_id: contactId,
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', eventId] })
    },
  })

  const addVendor = useMutation({
    mutationFn: async (contactId: string) => {
      unwrap(
        await linkContactToEventAction({
          event_id: eventId,
          contact_id: contactId,
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', eventId] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded-control animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!vendors || vendors.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-text-muted mb-3">No contacts assigned yet.</p>
          <ContactPopover
            excludeIds={[]}
            onAdd={(id) => addVendor.mutate(id)}
          >
            <button className="text-sm text-gray-700 border border-border rounded-control px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer">
              + Add Contact
            </button>
          </ContactPopover>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {vendors.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 border border-border rounded-control hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{link.vendor.name}</p>
                  <p className="text-xs text-text-muted">{CATEGORY_LABELS[link.vendor.category as keyof typeof CATEGORY_LABELS] || link.vendor.category}</p>
                </div>
                <button
                  onClick={() => removeVendor.mutate(link.contact_id)}
                  disabled={removeVendor.isPending}
                  className="p-1 text-text-subtle hover:text-red-600 transition disabled:opacity-50"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <ContactPopover
            excludeIds={vendors.map((v) => v.contact_id)}
            onAdd={(id) => addVendor.mutate(id)}
          >
            <button className="w-full text-sm text-gray-700 border border-border rounded-control px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer">
              + Add Contact
            </button>
          </ContactPopover>
        </>
      )}
    </div>
  )
}
