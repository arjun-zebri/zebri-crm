'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '../vendors/vendors-types'
import { X } from 'lucide-react'

interface VendorPickerProps {
  excludeVendorIds: string[]
  onAdd: (vendorId: string) => void
  onClose: () => void
  isAdding: boolean
}

interface Vendor {
  id: string
  name: string
  category: string
}

export function VendorPicker({
  excludeVendorIds,
  onAdd,
  onClose,
  isAdding,
}: VendorPickerProps) {
  const supabase = createClient()
  const [search, setSearch] = useState('')

  const { data: vendors, isLoading } = useQuery({
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
      return (data || []) as Vendor[]
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

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition"
        >
          <X size={16} />
        </button>
      </div>

      {filteredVendors.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          {vendors && vendors.length === 0
            ? 'No vendors available'
            : 'No vendors found'}
        </p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filteredVendors.map((vendor) => (
            <button
              key={vendor.id}
              onClick={() => {
                onAdd(vendor.id)
                setSearch('')
              }}
              disabled={isAdding}
              className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 border border-transparent hover:border-gray-200"
            >
              <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
              <p className="text-xs text-gray-500">
                {CATEGORY_LABELS[vendor.category as keyof typeof CATEGORY_LABELS] || vendor.category}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
