'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '../contacts/contacts-types'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { ContactPicker } from '../couples/contact-picker'

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
  const [showAddVendor, setShowAddVendor] = useState(false)

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
    mutationFn: async (contactLinkId: string) => {
      const { error } = await supabase
        .from('event_contacts')
        .delete()
        .eq('id', contactLinkId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', eventId] })
    },
  })

  const addVendor = useMutation({
    mutationFn: async (contactId: string) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('event_contacts')
        .insert({
          event_id: eventId,
          contact_id: contactId,
          user_id: user.user.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', eventId] })
      setShowAddVendor(false)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!vendors || vendors.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">No contacts assigned yet.</p>
          <button
            onClick={() => setShowAddVendor(true)}
            className="text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
          >
            + Add Contact
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {vendors.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{link.vendor.name}</p>
                  <p className="text-xs text-gray-500">{CATEGORY_LABELS[link.vendor.category as keyof typeof CATEGORY_LABELS] || link.vendor.category}</p>
                </div>
                <button
                  onClick={() => removeVendor.mutate(link.id)}
                  disabled={removeVendor.isPending}
                  className="p-1 text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAddVendor(true)}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
          >
            + Add Contact
          </button>
        </>
      )}

      {showAddVendor && (
        <ContactPicker
          excludeVendorIds={vendors?.map(v => v.contact_id) ?? []}
          onAdd={(contactId) => addVendor.mutate(contactId)}
          onClose={() => setShowAddVendor(false)}
          isAdding={addVendor.isPending}
        />
      )}
    </div>
  )
}
