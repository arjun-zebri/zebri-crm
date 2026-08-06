'use client'

import * as Popover from '@radix-ui/react-popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, type Contact } from '@/types/contact'

import { ContactModal } from '../contacts/contact-modal'

interface ContactSummary {
  id: string
  name: string
  category: string
  created_at: string
}

interface ContactPopoverProps {
  excludeIds: string[]
  onAdd: (contactId: string) => void
  /** Trigger element. Forwarded to `Popover.Trigger asChild`. */
  children: React.ReactNode
  /** Optional controlled-open state. When provided the popover is
   *  driven by the parent (e.g. opened in response to a menu item
   *  click rather than a click on `children`). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Search-and-attach popover for contacts.
 *
 * Opens off a caller-provided trigger. Body: a search input, a
 * filtered result list, and a single "Create new contact" footer
 * button. Selecting a row attaches that contact (via `onAdd`) and
 * closes the popover. Clicking "Create new contact" opens the full
 * `ContactModal` so the user can fill in real details (category,
 * phone, email, notes); on save the new contact is inserted and
 * immediately attached.
 *
 * @module app/(dashboard)/couples/contact-popover
 */
export function ContactPopover({
  excludeIds,
  onAdd,
  children,
  open: controlledOpen,
  onOpenChange,
}: ContactPopoverProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  // The ContactModal must mount outside the parent <form> (HTML
  // doesn't allow nested forms). Defer the portal target read until
  // the component is mounted so SSR stays happy.
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['all-contacts'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      // Match ContactPicker's select so the shared cache stays
      // consistent across consumers.
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, category, created_at')
        .eq('user_id', user.user.id)
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (error) throw error
      return (data || []) as ContactSummary[]
    },
    enabled: open,
  })

  const createContact = useMutation({
    mutationFn: async (
      data: Omit<Contact, 'id' | 'user_id' | 'created_at'>,
    ) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.user.id,
          name: data.name,
          contact_name: data.contact_name,
          phone: data.phone,
          email: data.email,
          category: data.category,
          status: data.status,
          notes: data.notes,
        })
        .select('id')
        .single()

      if (error) throw error
      return inserted.id as string
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      onAdd(newId)
      setCreateOpen(false)
      setOpen(false)
      setSearch('')
    },
  })

  const trimmed = search.trim()
  const filtered = useMemo(() => {
    if (!contacts) return []
    const remain = contacts.filter((c) => !excludeIds.includes(c.id))
    if (!trimmed) return remain
    const q = trimmed.toLowerCase()
    return remain.filter((c) => c.name.toLowerCase().includes(q))
  }, [contacts, excludeIds, trimmed])

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setSearch('')
        }}
      >
        <Popover.Trigger asChild>{children}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="w-72 bg-white border border-gray-200 rounded-control shadow-lg z-[80] overflow-hidden"
            sideOffset={6}
            align="start"
          >
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
              {isLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  Loading...
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  {(contacts?.length ?? 0) === 0
                    ? 'No contacts yet'
                    : 'No matches'}
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onAdd(c.id)
                      setSearch('')
                      setOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-gray-900 truncate">
                      {c.name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {CATEGORY_LABELS[
                        c.category as keyof typeof CATEGORY_LABELS
                      ] || c.category}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  // Close the popover when handing off to the modal
                  // so the two surfaces don't stack on screen.
                  setOpen(false)
                  setCreateOpen(true)
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition cursor-pointer flex items-center gap-2 text-sm text-gray-700"
              >
                <Plus
                  size={12}
                  strokeWidth={2}
                  className="text-gray-400"
                />
                Create new contact
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {portalTarget &&
        createPortal(
          <ContactModal
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            onSave={(data) => createContact.mutate(data)}
            onDelete={() => {}}
            loading={createContact.isPending}
            nested
          />,
          portalTarget,
        )}
    </>
  )
}
