'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '../contacts/contacts-types'
import { Trash2, Plus } from 'lucide-react'
import { ContactPicker } from './contact-picker'
import { useToast } from '@/components/ui/toast'

interface CoupleVendorsProps {
  coupleId: string
  onLoadingChange?: (loading: boolean) => void
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

interface PortalPerson {
  id: string
  category: 'partner' | 'bridal_party' | 'family' | 'other'
  full_name: string
  role: string | null
}

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  partner: 'Partners',
  bridal_party: 'Bridal Party',
  family: 'Family',
  other: 'Other',
}

export function CoupleVendors({ coupleId, onLoadingChange }: CoupleVendorsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showAddVendor, setShowAddVendor] = useState(false)

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
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

  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ['couple-portal-people', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_people')
        .select('id, category, full_name, role')
        .eq('couple_id', coupleId)
        .order('position', { ascending: true })

      if (error) throw error
      return (data || []) as PortalPerson[]
    },
  })

  const isLoading = vendorsLoading || peopleLoading

  useEffect(() => { onLoadingChange?.(isLoading) }, [isLoading])

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
    onError: () => toast('Failed to remove contact'),
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
    onError: () => toast('Failed to add contact'),
  })

  const groupedPeople = (['partner', 'bridal_party', 'family', 'other'] as const).map((cat) => ({
    category: cat,
    label: CATEGORY_GROUP_LABELS[cat],
    members: (people ?? []).filter((p) => p.category === cat),
  })).filter((g) => g.members.length > 0)

  return (
    <div className="space-y-4">
      {/* Wedding party (read-only, added by couple via portal) */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : groupedPeople.length > 0 && (
        <div className="space-y-4">
          {groupedPeople.map((group) => (
            <div key={group.category}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{group.label}</h4>
              <div className="space-y-0">
                {group.members.map((person) => (
                  <div key={person.id} className="flex items-center py-2.5 -mx-2 px-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{person.full_name}</p>
                      {person.role && (
                        <p className="text-xs text-gray-400">{person.role}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-gray-100" />
        </div>
      )}

      {/* Vendor contacts */}
      <div>
        <button
          onClick={() => setShowAddVendor(true)}
          className="group flex items-center gap-1.5 mb-1 cursor-pointer"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">Vendors</h3>
          <Plus size={12} strokeWidth={2} className="text-gray-900 group-hover:text-gray-600 transition" />
        </button>

        {vendorsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !vendors || vendors.length === 0 ? (
          <p className="text-sm text-gray-400 py-1">No vendors yet.</p>
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
      </div>

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
