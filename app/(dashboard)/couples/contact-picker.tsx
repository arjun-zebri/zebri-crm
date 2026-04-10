'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '../contacts/contacts-types'
import { X } from 'lucide-react'

interface ContactPickerProps {
  excludeVendorIds: string[]
  onAdd: (contactId: string) => void
  onClose: () => void
  isAdding: boolean
}

interface Contact {
  id: string
  name: string
  category: string
}

export function ContactPicker({
  excludeVendorIds,
  onAdd,
  onClose,
  isAdding,
}: ContactPickerProps) {
  const supabase = createClient()
  const [search, setSearch] = useState('')

  const { data: vendors, isLoading } = useQuery({
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
      return (data || []) as Contact[]
    },
  })

  const filteredVendors = useMemo(() => {
    if (!vendors) return []
    return vendors.filter(
      (v) =>
        !excludeVendorIds.includes(v.id) &&
        v.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [vendors, search, excludeVendorIds])

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-[60]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 pointer-events-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Add Contact</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-5 py-3">
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full text-sm text-gray-900 placeholder:text-gray-400 outline-none border-none bg-transparent"
            />
          </div>

          <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredVendors.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                {vendors && vendors.length === 0 ? 'No contacts available' : 'No contacts found'}
              </p>
            ) : (
              <div className="py-1">
                {filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    onClick={() => {
                      onAdd(vendor.id)
                      setSearch('')
                    }}
                    disabled={isAdding}
                    className="w-full text-left px-5 py-2.5 hover:bg-gray-50 transition disabled:opacity-50 cursor-pointer"
                  >
                    <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABELS[vendor.category as keyof typeof CATEGORY_LABELS] || vendor.category}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
