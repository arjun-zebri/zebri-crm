'use client'

import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, Contact } from '@/types/contact'
import type { Couple } from '@/types/couple'

import { ContactModal } from '../contacts/contact-modal'

import { ContactPicker } from './contact-picker'
import {
  addCoupleContactLinkAction,
  deleteContactAction,
  deleteCoupleContactLinkAction,
  updateContactAction,
} from './portal-actions'
import type { PortalPerson } from './use-portal-data'
import { PARTNER_ROLES, BRIDAL_ROLES, FAMILY_ROLES } from './use-portal-data'

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}

const OTHER_ROLES = ['Officiant', 'Celebrant', 'Photographer', 'Videographer', 'Performer', 'Speaker', 'Guest', 'Other']

interface ContactLink {
  id: string
  contact_id: string
  vendor: Contact
}

// Couple partners are now sourced from `couples.primary_*` and
// `couples.secondary_*` (Phase: Option B). The `partner` portal_people
// category is left in the type union for legacy data but is no
// longer surfaced as its own section here or in the add menu.
const PEOPLE_CATEGORIES = [
  { label: 'Bridal party', category: 'bridal_party', roles: BRIDAL_ROLES },
  { label: 'Family', category: 'family', roles: FAMILY_ROLES },
  { label: 'Other', category: 'other', roles: OTHER_ROLES },
]

const MENU_CATEGORIES = PEOPLE_CATEGORIES.slice(0, 2)

const AVATAR_COLORS: Record<string, string> = {
  partner: 'bg-emerald-50 text-emerald-600',
  bridal_party: 'bg-violet-50 text-violet-600',
  family: 'bg-amber-50 text-amber-600',
  other: 'bg-gray-100 text-gray-500',
}

interface McPortalContactsProps {
  couple: Couple
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
  couple, people, isPeopleLoading, coupleId, onEditPerson, onAddPerson,
}: McPortalContactsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | undefined>()

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['couple-contacts', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('couple_contacts')
        .select('id, contact_id, vendor:contact_id(id, name, contact_name, category, status, phone, email, notes)')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as ContactLink[]
    },
  })

  const removeVendor = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteCoupleContactLinkAction(id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] }),
    onError: () => toast('Failed to remove vendor'),
  })

  const addVendor = useMutation({
    mutationFn: async (contactId: string) => {
      unwrap(
        await addCoupleContactLinkAction({
          couple_id: coupleId,
          contact_id: contactId,
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] })
      setShowContactPicker(false)
    },
    onError: () => toast('Failed to add vendor'),
  })

  const updateContact = useMutation({
    mutationFn: async (contact: Omit<Contact, 'user_id' | 'created_at'> & { id: string }) => {
      const { id, name, email, phone, contact_name, category, notes } = contact
      unwrap(
        await updateContactAction({
          id,
          patch: { name, email, phone, contact_name, category, notes },
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      setEditingContact(undefined)
      toast('Contact updated')
    },
    onError: () => toast('Failed to update contact'),
  })

  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      unwrap(await deleteContactAction(contactId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-contacts', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      setEditingContact(undefined)
      toast('Contact deleted')
    },
    onError: () => toast('Failed to delete contact'),
  })

  const isLoading = isPeopleLoading || vendorsLoading
  const hasVendors = (vendors?.length ?? 0) > 0
  const visibleCategories = PEOPLE_CATEGORIES.filter(({ category }) =>
    people.some((p) => p.category === category)
  )
  // Couple partners come from the couple row itself (post-Option-B).
  // Only render a partner if at least one of name/email/phone is set,
  // so half-filled rows don't show empty placeholders.
  const couplePartners = (
    [
      {
        role: 'Primary',
        name: couple.primary_name ?? '',
        email: couple.primary_email ?? '',
        phone: couple.primary_phone ?? '',
      },
      {
        role: 'Secondary',
        name: couple.secondary_name ?? '',
        email: couple.secondary_email ?? '',
        phone: couple.secondary_phone ?? '',
      },
    ] as const
  ).filter((p) => p.name || p.email || p.phone)
  const hasCouplePartners = couplePartners.length > 0
  const hasPeople = visibleCategories.length > 0
  const isEmpty =
    !isLoading && !hasPeople && !hasVendors && !hasCouplePartners
  const modalLoading = updateContact.isPending || deleteContact.isPending

  return (
    <div className="pt-3">
      {/* Left-aligned header-style action, matching the Events tab
          pattern on the Overview surface. The trailing "+" anchors
          the popover that branches into Wedding Party / Vendor. */}
      <div className="mb-3">
        <Popover.Root open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <Popover.Trigger asChild>
            <button className="group flex items-center gap-1.5 cursor-pointer">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">
                Add contact
              </h3>
              <Plus
                size={12}
                strokeWidth={2}
                className="text-gray-900 group-hover:text-gray-600 transition"
              />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-white border border-gray-200 rounded-xl shadow-lg z-[70] w-44 py-1"
              sideOffset={6}
              align="start"
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
          {isEmpty && !hasCouplePartners && (
            <p className="text-sm text-gray-400">No contacts added yet.</p>
          )}

          {hasCouplePartners && (
            <div className="mb-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Couple
                </h3>
                <CountBadge count={couplePartners.length} />
              </div>
              <div className="space-y-0.5">
                {couplePartners.map((p) => (
                  <div
                    key={p.role}
                    className="flex items-center gap-3 min-h-[40px] py-1.5 -mx-2 px-2 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 select-none bg-emerald-50 text-emerald-600">
                      {p.name ? initials(p.name) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {p.name || `${p.role} (unnamed)`}
                      </p>
                      {(p.email || p.phone) && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {[p.email, p.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleCategories.map(({ label, category, roles }, renderIdx) => {
            const items = people.filter((p) => p.category === category)
            const avatarColor = AVATAR_COLORS[category]
            return (
              <div key={category} className={renderIdx > 0 || hasCouplePartners ? 'border-t border-gray-100 pt-5 mt-1' : ''}>
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
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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
                      <Pencil size={12} strokeWidth={1.5} className="text-gray-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {hasVendors && (
            <div className={hasPeople || hasCouplePartners ? 'border-t border-gray-100 pt-5 mt-1' : ''}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vendors</h3>
                <CountBadge count={vendors!.length} />
              </div>
              <div className="space-y-0.5">
                {vendors!.map((link) => (
                  <div
                    key={link.id}
                    onClick={() => setEditingContact(link.vendor)}
                    className="group flex items-center py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{link.vendor.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {CATEGORY_LABELS[link.vendor.category as keyof typeof CATEGORY_LABELS] || link.vendor.category}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeVendor.mutate(link.id) }}
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

      <ContactModal
        isOpen={!!editingContact}
        onClose={() => setEditingContact(undefined)}
        nested
        onSave={(contact) => {
          if (contact.id) updateContact.mutate(contact as Contact)
        }}
        onDelete={(id) => deleteContact.mutate(id)}
        vendor={editingContact}
        loading={modalLoading}
      />
    </div>
  )
}
