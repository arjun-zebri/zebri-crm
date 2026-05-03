'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, CATEGORIES, type ContactCategory } from '../contacts/contacts-types'
import { X, Plus, ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

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

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

export function ContactPicker({
  excludeVendorIds,
  onAdd,
  onClose,
  isAdding,
}: ContactPickerProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'search' | 'create'>('search')
  const [createName, setCreateName] = useState('')
  const [createCategory, setCreateCategory] = useState<ContactCategory>('other')
  const [categoryOpen, setCategoryOpen] = useState(false)

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

  const createContact = useMutation({
    mutationFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.user.id,
          name: createName.trim(),
          category: createCategory,
          status: 'active',
          contact_name: '',
          email: '',
          phone: '',
          notes: '',
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      onAdd(newId)
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

  const showCreatePrompt = !isLoading && search.trim().length > 0 && filteredVendors.length === 0

  if (view === 'create') {
    return (
      <>
        <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 pointer-events-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">New contact</h2>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <Popover.Root open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 hover:border-gray-300 transition cursor-pointer"
                    >
                      <span>{CATEGORY_LABELS[createCategory]}</span>
                      <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="bg-white border border-gray-200 rounded-xl shadow-lg z-[80] py-1 max-h-60 overflow-y-auto"
                      style={{ width: 'var(--radix-popover-trigger-width)' }}
                      sideOffset={4}
                      align="start"
                    >
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { setCreateCategory(cat); setCategoryOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm transition cursor-pointer ${
                            createCategory === cat
                              ? 'bg-gray-100 text-gray-900 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {CATEGORY_LABELS[cat]}
                        </button>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>
            <div className="px-5 pb-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setView('search')}
                className="text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => createContact.mutate()}
                disabled={!createName.trim() || createContact.isPending || isAdding}
                className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
              >
                {createContact.isPending ? 'Creating...' : 'Create & add'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 pointer-events-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Add Contact</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer">
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

          <div className="border-t border-gray-100 h-52 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : showCreatePrompt ? (
              <div className="py-2">
                <p className="text-xs text-gray-400 px-5 pt-3 pb-1">No contacts found</p>
                <button
                  onClick={() => { setCreateName(search.trim()); setView('create') }}
                  className="w-full text-left px-5 py-2.5 hover:bg-gray-50 transition cursor-pointer flex items-center gap-2"
                >
                  <Plus size={14} strokeWidth={2} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">
                    Create <span className="font-medium">"{search.trim()}"</span>
                  </span>
                </button>
              </div>
            ) : filteredVendors.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                {vendors && vendors.length === 0 ? 'No contacts yet' : 'No contacts found'}
              </p>
            ) : (
              <div className="py-1">
                {filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    onClick={() => { onAdd(vendor.id); setSearch('') }}
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
