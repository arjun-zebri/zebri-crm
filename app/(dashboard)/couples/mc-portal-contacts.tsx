'use client'

import { useState } from 'react'
import { Play, Pencil, Plus, Trash2, ExternalLink } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '../contacts/contacts-types'
import { ContactPicker } from './contact-picker'
import { useToast } from '@/components/ui/toast'
import type { PortalPerson } from './use-portal-data'
import { PARTNER_ROLES, BRIDAL_ROLES, FAMILY_ROLES } from './use-portal-data'
import Link from 'next/link'

const OTHER_ROLES = ['Officiant', 'Celebrant', 'Photographer', 'Videographer', 'Performer', 'Speaker', 'Guest', 'Other']

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

const PEOPLE_CATEGORIES = [
  { label: 'Couple', category: 'partner', roles: PARTNER_ROLES },
  { label: 'Bridal party', category: 'bridal_party', roles: BRIDAL_ROLES },
  { label: 'Family', category: 'family', roles: FAMILY_ROLES },
  { label: 'Other', category: 'other', roles: OTHER_ROLES },
]

const MENU_CATEGORIES = PEOPLE_CATEGORIES.slice(0, 3)

const AVATAR_COLORS: Record<string, string> = {
  partner: 'bg-emerald-50 text-emerald-600',
  bridal_party: 'bg-violet-50 text-violet-600',
  family: 'bg-amber-50 text-amber-600',
  other: 'bg-gray-100 text-gray-500',
  vendor: 'bg-sky-50 text-sky-600',
}

interface McPortalContactsProps {
  people: PortalPerson[]
  isPeopleLoading: boolean
  coupleId: string
  onEditPerson: (person: PortalPerson, roles: string[]) => void
  onAddPerson: (category: string, roles: string[]) => void
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-400 font-normal tabular-nums">
      {count}
    </span>
  )
}

export function McPortalContacts({
  people, isPeopleLoading, coupleId, onEditPerson, onAddPerson,
}: McPortalContactsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)

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

  const removeVendor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('couple_contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] }),
    onError: () => toast('Failed to remove vendor'),
  })

  const addVendor = useMutation({
    mutationFn: async (contactId: string) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('couple_contacts').insert({
        couple_id: coupleId, contact_id: contactId, user_id: user.user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] })
      setShowContactPicker(false)
    },
    onError: () => toast('Failed to add vendor'),
  })

  const isLoading = isPeopleLoading || vendorsLoading
  const hasVendors = (vendors?.length ?? 0) > 0

  // Only the categories that have members, in display order
  const visibleCategories = PEOPLE_CATEGORIES.filter(({ category }) =>
    people.some((p) => p.category === category)
  )
  const hasPeople = visibleCategories.length > 0
  const isEmpty = !isLoading && !hasPeople && !hasVendors

  return (
    <div className="pt-3">
      <div className="flex justify-end mb-1.5">
        <Popover.Root open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer">
              <Plus size={14} strokeWidth={2} />
              Add contact
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-white border border-gray-200 rounded-xl shadow-lg z-[70] w-44 py-1"
              sideOffset={6}
              align="end"
            >
              <p className="px-3 pt-2 pb-1 text-xs text-gray-400">Wedding party</p>
              {MENU_CATEGORIES.map(({ label, category, roles }) => (
                <button
                  key={category}
                  onClick={() => { setAddMenuOpen(false); onAddPerson(category, roles) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  {label}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { setAddMenuOpen(false); setShowContactPicker(true) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Vendor
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 min-h-[40px]">
              <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-2.5 w-16 bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {isEmpty && (
            <p className="text-sm text-gray-400">No contacts added yet.</p>
          )}

          {visibleCategories.map(({ label, category, roles }, renderIdx) => {
            const items = people.filter((p) => p.category === category)
            const avatarColor = AVATAR_COLORS[category]
            return (
              <div key={category} className={renderIdx > 0 ? 'border-t border-gray-100 pt-5 mt-1' : ''}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</h3>
                  <CountBadge count={items.length} />
                </div>
                <div className="space-y-0.5">
                  {items.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 min-h-[40px] py-1.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition cursor-pointer group"
                      onClick={() => onEditPerson(person, roles)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 select-none ${avatarColor}`}>
                        {person.full_name ? initials(person.full_name) : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{person.full_name || 'Unnamed'}</p>
                        {(person.role || person.phonetic) && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {person.role}
                            {person.role && person.phonetic ? ' · ' : ''}
                            {person.phonetic}
                          </p>
                        )}
                      </div>
                      {person.audio_url && (
                        <div
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <audio src={person.audio_url} id={`mc-audio-${person.id}`} className="hidden" />
                          <button
                            onClick={() => (document.getElementById(`mc-audio-${person.id}`) as HTMLAudioElement)?.play()}
                            className="flex items-center justify-center w-7 h-7 text-gray-600 hover:text-gray-800 transition cursor-pointer rounded-lg hover:bg-gray-100"
                            title="Play pronunciation"
                          >
                            <Play size={12} strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                      <Pencil
                        size={12}
                        strokeWidth={1.5}
                        className="text-gray-300 shrink-0 opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {hasVendors && (
            <div className={hasPeople ? 'border-t border-gray-100 pt-5 mt-1' : ''}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vendors</h3>
                <CountBadge count={vendors!.length} />
              </div>
              <div className="space-y-0.5">
                {vendors!.map((link) => (
                  <div
                    key={link.id}
                    className="group flex items-center gap-3 min-h-[40px] py-1.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 select-none ${AVATAR_COLORS.vendor}`}>
                      {link.vendor.name ? initials(link.vendor.name) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{link.vendor.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {CATEGORY_LABELS[link.vendor.category as keyof typeof CATEGORY_LABELS] || link.vendor.category}
                      </p>
                    </div>
                    <Link
                      href="/contacts"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition shrink-0"
                      title="View in contacts"
                    >
                      <ExternalLink size={12} strokeWidth={1.5} />
                    </Link>
                    <button
                      onClick={() => removeVendor.mutate(link.id)}
                      disabled={removeVendor.isPending}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition disabled:opacity-50 opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showContactPicker && (
        <ContactPicker
          excludeVendorIds={vendors?.map((v) => v.contact_id) ?? []}
          onAdd={(contactId) => addVendor.mutate(contactId)}
          onClose={() => setShowContactPicker(false)}
          isAdding={addVendor.isPending}
        />
      )}
    </div>
  )
}
