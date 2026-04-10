'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '../contacts/contacts-types'
import { Trash2, Plus } from 'lucide-react'
import { ContactPicker } from './contact-picker'

interface CoupleVendorsProps {
  coupleId: string
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

export function CoupleVendors({ coupleId }: CoupleVendorsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [showAddVendor, setShowAddVendor] = useState(false)

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['couple-contacts', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('couple_contacts')
        .select('id, contact_id, vendor:contact_id(id, name, category, status)')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as ContactLink[]
    },
  })

  const removeVendor = useMutation({
    mutationFn: async (contactLinkId: string) => {
      const { error } = await supabase
        .from('couple_contacts')
        .delete()
        .eq('id', contactLinkId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] })
    },
  })

  const addVendor = useMutation({
    mutationFn: async (contactId: string) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('couple_contacts')
        .insert({
          couple_id: coupleId,
          contact_id: contactId,
          user_id: user.user.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] })
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
    <div className="space-y-3">
      {/* Header */}
      <button
        onClick={() => setShowAddVendor(true)}
        className="group flex items-center gap-1.5 mb-1 cursor-pointer"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">Contacts</h3>
        <Plus size={12} strokeWidth={2} className="text-gray-900 group-hover:text-gray-600 transition" />
      </button>

      {!vendors || vendors.length === 0 ? (
        <p className="text-sm text-gray-300 py-1">No contacts added yet</p>
      ) : (
        <div className="space-y-0">
          {vendors.map((link) => (
            <div
              key={link.id}
              className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2 transition"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">{link.vendor.name}</p>
                <p className="text-xs text-gray-400">{CATEGORY_LABELS[link.vendor.category as keyof typeof CATEGORY_LABELS] || link.vendor.category}</p>
              </div>
              <button
                onClick={() => removeVendor.mutate(link.id)}
                disabled={removeVendor.isPending}
                className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-50 opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
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
