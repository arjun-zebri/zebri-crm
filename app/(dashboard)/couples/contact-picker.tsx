'use client'

import * as Popover from '@radix-ui/react-popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type ContactCategory,
} from '@/types/contact'

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
  created_at: string
}

// Underline input vocabulary - matches the couple/event modals the
// picker pops out of, so the three surfaces look like one product.
const inputClass =
  'w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition'
const labelClass = 'block text-sm text-gray-600 mb-1'

// One pastel dot per category. Just enough colour for someone
// scanning the list to spot "the photographer" without parsing the
// gray sublabel. Tailwind tokens are pinned so the palette stays
// consistent across rows; if a category ever lands without a colour
// we fall back to gray.
const CATEGORY_DOT: Record<string, string> = {
  venue: 'bg-amber-300',
  celebrant: 'bg-rose-300',
  photographer: 'bg-violet-300',
  videographer: 'bg-purple-300',
  dj: 'bg-sky-300',
  florist: 'bg-pink-300',
  hair_makeup: 'bg-fuchsia-300',
  caterer: 'bg-orange-300',
  photo_booth: 'bg-cyan-300',
  lighting_av: 'bg-blue-300',
  planner: 'bg-emerald-300',
  other: 'bg-gray-300',
}

const categoryDot = (category: string) =>
  CATEGORY_DOT[category] ?? 'bg-gray-300'

const RECENT_LIMIT = 3

/**
 * Picker for attaching a contact to a couple or event.
 *
 * Two explicit modes share one modal surface:
 * - **browse** - search + category-filtered list, with a "Recent"
 *   group at the top when no filters are applied. Each row has a
 *   category colour dot and a + affordance so the action stays
 *   obvious on touch devices.
 * - **create** - reached by clicking an explicit "Create" button
 *   (either from the cold-start empty state or from the no-match
 *   state, which seeds the typed search into Name). The form
 *   captures Name, Email, Phone, Category in one round-trip.
 *
 * The modal frame is height-locked (`min-h-[420px]`) so switching
 * modes doesn't make the dialog visibly grow or shrink under the
 * cursor. The footer is always present for the same reason.
 *
 * Always rendered as a nested modal - every caller opens it from
 * inside another modal (Event modal, Couple profile overlay).
 *
 * @module app/(dashboard)/couples/contact-picker
 */
export function ContactPicker({
  excludeVendorIds,
  onAdd,
  onClose,
  isAdding,
}: ContactPickerProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<'browse' | 'create'>('browse')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ContactCategory | null>(
    null,
  )

  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createCategory, setCreateCategory] = useState<ContactCategory>('other')
  const [categoryOpen, setCategoryOpen] = useState(false)

  const { data: vendors, isLoading } = useQuery({
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
          email: createEmail.trim(),
          phone: createPhone.trim(),
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

  // Available pool: everything minus what's already attached at the
  // call site. Category and search filters apply on top.
  const available = useMemo(
    () => (vendors ?? []).filter((v) => !excludeVendorIds.includes(v.id)),
    [vendors, excludeVendorIds],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return available.filter((v) => {
      if (activeCategory && v.category !== activeCategory) return false
      if (q.length > 0 && !v.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [available, activeCategory, search])

  // Only show category chips for categories the user actually has
  // contacts in - keeps the filter row tight and meaningful.
  const usedCategories = useMemo(() => {
    const set = new Set(available.map((v) => v.category))
    return CATEGORIES.filter((c) => set.has(c))
  }, [available])

  // "Recent" only appears when the list is unfiltered - the moment
  // the user starts searching or filters by category, the section
  // disappears so it doesn't compete with their query.
  const showRecent = search.trim().length === 0 && !activeCategory
  const recent = useMemo(() => {
    if (!showRecent) return []
    return [...available]
      .sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
      )
      .slice(0, RECENT_LIMIT)
  }, [available, showRecent])
  const recentIds = useMemo(() => new Set(recent.map((r) => r.id)), [recent])
  const restList = useMemo(
    () => filtered.filter((v) => !recentIds.has(v.id)),
    [filtered, recentIds],
  )

  const openCreate = (seedName: string) => {
    setCreateName(seedName)
    setCreateEmail('')
    setCreatePhone('')
    setCreateCategory('other')
    setMode('create')
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim() || createContact.isPending || isAdding) return
    createContact.mutate()
  }

  const canCreate = mode === 'create' && createName.trim().length > 0

  return (
    <Modal
      isOpen
      onClose={onClose}
      nested
      size="md"
      title="Add contact"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={mode === 'create' ? () => setMode('browse') : onClose}
            className="text-sm px-4 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition cursor-pointer"
          >
            {mode === 'create' ? 'Back' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => createContact.mutate()}
            disabled={!canCreate || createContact.isPending || isAdding}
            className="text-sm px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {createContact.isPending ? 'Creating...' : 'Create & add'}
          </button>
        </div>
      }
    >
      {/* Body height is locked to match the event modal's natural
          height so the two stacked surfaces look like the same
          dialog frame. Also keeps the picker steady when switching
          between browse and create modes. */}
      <div className="space-y-3 min-h-[520px]">
        {mode === 'browse' ? (
          <>
            {/* Search input (no label - placeholder does the work) */}
            <input
              type="text"
              placeholder="Search contacts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className={inputClass}
            />

            {/* Category filter chips - only categories the user has
                contacts in. Click toggles; black = active. */}
            {usedCategories.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
                {usedCategories.map((cat) => {
                  const active = activeCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setActiveCategory(active ? null : cat)
                      }
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs transition cursor-pointer ${
                        active
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${categoryDot(cat)}`}
                      />
                      {CATEGORY_LABELS[cat]}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Content area - bleeds edge-to-edge so rows feel like
                a list, not floating cards. */}
            <div className="-mx-4 sm:-mx-6 min-h-[280px]">
              {isLoading ? (
                <div className="px-4 sm:px-6 space-y-2 pt-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-gray-100 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : available.length === 0 ? (
                <ColdEmpty onCreate={() => openCreate('')} />
              ) : filtered.length === 0 ? (
                <NoMatch
                  search={search}
                  onCreate={() => openCreate(search.trim())}
                />
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {showRecent && recent.length > 0 && (
                    <>
                      <SectionHeader>Recent</SectionHeader>
                      {recent.map((v) => (
                        <ContactRow
                          key={v.id}
                          vendor={v}
                          disabled={isAdding}
                          onClick={() => {
                            onAdd(v.id)
                            setSearch('')
                          }}
                        />
                      ))}
                      {restList.length > 0 && (
                        <SectionHeader>All contacts</SectionHeader>
                      )}
                    </>
                  )}
                  {restList.map((v) => (
                    <ContactRow
                      key={v.id}
                      vendor={v}
                      disabled={isAdding}
                      onClick={() => {
                        onAdd(v.id)
                        setSearch('')
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // ── Create form ─────────────────────────────────────────
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Contact name"
                autoFocus
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="email@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="+61 400 000 000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <Popover.Root
                open={categoryOpen}
                onOpenChange={setCategoryOpen}
              >
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className={`${inputClass} flex items-center justify-between text-left`}
                  >
                    <span className="inline-flex items-center gap-2 text-gray-900">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${categoryDot(createCategory)}`}
                      />
                      {CATEGORY_LABELS[createCategory]}
                    </span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className="text-gray-400 shrink-0"
                    />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="bg-white border border-gray-200 rounded-xl shadow-lg z-[90] py-1 max-h-60 overflow-y-auto"
                    style={{ width: 'var(--radix-popover-trigger-width)' }}
                    sideOffset={4}
                    align="start"
                  >
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCreateCategory(cat)
                          setCategoryOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition cursor-pointer flex items-center gap-2 ${
                          createCategory === cat
                            ? 'bg-gray-100 text-gray-900 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${categoryDot(cat)}`}
                        />
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
            {/* Hidden submit so Enter from any field submits the form */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        )}
      </div>
    </Modal>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-6 pt-3 pb-1 text-xs uppercase tracking-wider text-gray-400">
      {children}
    </div>
  )
}

function ContactRow({
  vendor,
  onClick,
  disabled,
}: {
  vendor: Contact
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-full text-left px-4 sm:px-6 py-3 hover:bg-gray-50 transition disabled:opacity-50 cursor-pointer flex items-center gap-3"
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${categoryDot(vendor.category)}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 truncate">{vendor.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {CATEGORY_LABELS[vendor.category as keyof typeof CATEGORY_LABELS] ||
            vendor.category}
        </p>
      </div>
      <Plus
        size={14}
        strokeWidth={1.5}
        className="text-gray-300 group-hover:text-gray-600 shrink-0 transition"
      />
    </button>
  )
}

function ColdEmpty({ onCreate }: { onCreate: () => void }) {
  // Mirror the couple-profile Events tab pattern: a quiet
  // header-style action ("ADD CONTACT +") above a single-line
  // empty-state message. Same visual rhythm, same affordance.
  return (
    <div className="px-4 sm:px-6 pt-3">
      <button
        type="button"
        onClick={onCreate}
        className="group flex items-center gap-1.5 mb-3 cursor-pointer"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">
          Add contact
        </h3>
        <Plus
          size={12}
          strokeWidth={2}
          className="text-gray-900 group-hover:text-gray-600 transition"
        />
      </button>
      <p className="text-sm text-gray-400 py-1">No contacts yet.</p>
    </div>
  )
}

function NoMatch({
  search,
  onCreate,
}: {
  search: string
  onCreate: () => void
}) {
  const trimmed = search.trim()
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <p className="text-sm text-gray-400 mb-3">
        {trimmed ? `No contacts match "${trimmed}"` : 'No contacts in this category'}
      </p>
      {trimmed && (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-xl transition cursor-pointer"
        >
          <Plus size={14} strokeWidth={1.5} />
          Create "{trimmed}"
        </button>
      )}
    </div>
  )
}
