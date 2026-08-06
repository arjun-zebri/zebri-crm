'use client'

import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'

import { AudioPlayButton } from '@/components/ui/audio-play-button'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, Contact } from '@/types/contact'
import type { Couple } from '@/types/couple'

import { ContactModal } from '../contacts/contact-modal'

import { CoupleTabEmpty, CoupleTabShell } from './couple-tab-shell'
import {
  addCoupleContactLinkAction,
  deleteContactAction,
  deleteCoupleContactLinkAction,
  updateContactAction,
} from './portal-actions'
import type { PortalPerson } from './use-portal-data'
import { BRIDAL_ROLES, FAMILY_ROLES } from './use-portal-data'

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

// All three person categories surface in the "Add contact" menu so
// MCs / celebrants have an "Other" bucket for people who don't fit
// bridal-party or family (e.g. officiant, guest speaker, performer).
const MENU_CATEGORIES = PEOPLE_CATEGORIES

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
    <span className="inline-flex items-center justify-center rounded-control px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-400 font-normal tabular-nums">
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
  // Single popover with mode-switching content: `type` shows the
  // wedding-party / vendor chooser, `vendor` swaps to a search-and-
  // create panel. The popover never closes/reopens between them, so
  // the surface feels like one stable floating control.
  const [addMode, setAddMode] = useState<'closed' | 'type' | 'vendor'>('closed')
  const [vendorSearch, setVendorSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
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
    },
    onError: () => toast('Failed to add vendor'),
  })

  // Lookup pool for the vendor popover. Same `['all-contacts']`
  // cache key (and select shape) used by every other contact picker
  // so they all share data.
  const { data: allContacts } = useQuery({
    queryKey: ['all-contacts'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, category, created_at')
        .eq('user_id', user.user.id)
        .eq('status', 'active')
        .order('name', { ascending: true })
      if (error) throw error
      return (data || []) as { id: string; name: string; category: string; created_at: string }[]
    },
    enabled: addMode === 'vendor',
  })

  // Insert + attach in one go when the user saves the inline
  // create modal. Mirrors ContactPopover's mutation shape.
  const createContact = useMutation({
    mutationFn: async (
      input: Omit<Contact, 'id' | 'user_id' | 'created_at'>,
    ) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.user.id,
          name: input.name,
          contact_name: input.contact_name,
          phone: input.phone,
          email: input.email,
          category: input.category,
          status: input.status,
          notes: input.notes,
        })
        .select('id')
        .single()
      if (error) throw error
      return inserted.id as string
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      addVendor.mutate(newId)
      setCreateOpen(false)
      setAddMode('closed')
      setVendorSearch('')
    },
    onError: () => toast('Failed to create contact'),
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
  // Count only people in the surfaced categories (legacy `partner` rows aren't
  // shown, and the couple itself comes from `couplePartners`) so the stat
  // matches the visible sections.
  const visiblePeopleCount = people.filter((p) =>
    PEOPLE_CATEGORIES.some((c) => c.category === p.category),
  ).length
  const contactsCount =
    couplePartners.length + visiblePeopleCount + (vendors?.length ?? 0)

  const actions = (
    <Popover.Root
      open={addMode !== 'closed'}
      onOpenChange={(o) => {
        if (!o) {
          setAddMode('closed')
          setVendorSearch('')
        } else if (addMode === 'closed') {
          setAddMode('type')
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button size="sm" className="cursor-pointer gap-1.5">
          <Plus size={14} strokeWidth={1.5} />
          Add contact
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`bg-white border border-gray-200 rounded-control shadow-lg z-[70] py-1 ${addMode === 'vendor' ? 'w-72' : 'w-44'}`}
          sideOffset={6}
          align="end"
          onOpenAutoFocus={(e) => {
            if (addMode === 'vendor') e.preventDefault()
          }}
        >
          {addMode === 'type' && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs text-gray-400">Wedding party</p>
              {MENU_CATEGORIES.map(({ label, category, roles }) => (
                <button
                  key={category}
                  onClick={() => { setAddMode('closed'); onAddPerson(category, roles) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  {label}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => setAddMode('vendor')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Vendor
              </button>
            </>
          )}

          {addMode === 'vendor' && (
            <VendorPickerBody
              search={vendorSearch}
              setSearch={setVendorSearch}
              contacts={allContacts ?? []}
              excludeIds={vendors?.map((v) => v.contact_id) ?? []}
              onPick={(id) => {
                addVendor.mutate(id)
                setVendorSearch('')
                setAddMode('closed')
              }}
              onCreate={() => {
                setAddMode('closed')
                setCreateOpen(true)
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )

  return (
    <CoupleTabShell
      title="Contacts"
      stats={contactsCount > 0 ? [{ label: `${contactsCount} total` }] : undefined}
      actions={actions}
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 min-h-[40px]">
              <div className="w-8 h-8 rounded-pill bg-gray-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 bg-gray-100 rounded-pill animate-pulse" />
                <div className="h-2.5 w-16 bg-gray-100 rounded-pill animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <CoupleTabEmpty
          icon={Users}
          title="No contacts yet"
          description="Add a wedding party member or vendor with the button above."
        />
      ) : (
        <>
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
                    className="flex items-center gap-3 min-h-[40px] py-1.5 -mx-2 px-2 rounded-control"
                  >
                    <div className="w-8 h-8 rounded-pill flex items-center justify-center text-xs font-medium shrink-0 select-none bg-emerald-50 text-emerald-600">
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
                      className="flex items-center gap-3 min-h-[40px] py-1.5 -mx-2 px-2 rounded-control hover:bg-gray-50 transition cursor-pointer group"
                      onClick={() => onEditPerson(person, roles)}
                    >
                      <div className={`w-8 h-8 rounded-pill flex items-center justify-center text-xs font-medium shrink-0 select-none ${avatarColor}`}>
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
                          <AudioPlayButton
                            src={person.audio_url}
                            title="Play pronunciation"
                            className="flex items-center justify-center w-7 h-7 transition cursor-pointer rounded-control"
                            idleClassName="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                            playingClassName="text-emerald-600 bg-emerald-50"
                          />
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
                    className="group flex items-center py-2.5 -mx-2 px-2 rounded-control hover:bg-gray-50 transition cursor-pointer"
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

      {/* New vendor contact - opened from the popover footer. */}
      <ContactModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(data) => createContact.mutate(data)}
        onDelete={() => {}}
        loading={createContact.isPending}
        nested
      />

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
    </CoupleTabShell>
  )
}

interface VendorPickerBodyProps {
  search: string
  setSearch: (v: string) => void
  contacts: { id: string; name: string; category: string }[]
  excludeIds: string[]
  onPick: (id: string) => void
  onCreate: () => void
}

function VendorPickerBody({
  search, setSearch, contacts, excludeIds, onPick, onCreate,
}: VendorPickerBodyProps) {
  const q = search.trim().toLowerCase()
  const filtered = contacts
    .filter((c) => !excludeIds.includes(c.id))
    .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))

  return (
    <>
      <div className="px-3 py-2 border-b border-gray-100">
        <input
          type="text"
          placeholder="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 outline-none border-none bg-transparent"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {contacts.length === 0 ? 'No contacts yet' : 'No matches'}
          </p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between gap-2"
            >
              <span className="text-sm text-gray-900 truncate">{c.name}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] || c.category}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-gray-100">
        <button
          type="button"
          onClick={onCreate}
          className="w-full text-left px-3 py-2 hover:bg-gray-50 transition cursor-pointer flex items-center gap-2 text-sm text-gray-700"
        >
          <Plus size={12} strokeWidth={2} className="text-gray-400" />
          Create new contact
        </button>
      </div>
    </>
  )
}
