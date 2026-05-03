'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from './use-contacts'
import { ContactsHeader } from './contacts-header'
import { ContactsList } from './contacts-list'
import { ContactModal } from './contact-modal'
import { ContactProfile } from './contact-profile'
import {
  Contact,
  ContactCategory,
  ContactStatus,
  SortField,
  SortDirection,
  CATEGORY_LABELS,
} from './contacts-types'

export default function ContactsPage() {
  const { data: vendors, isLoading } = useContacts()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | null>(null)
  const [statusFilter, setStatusFilter] = useState<ContactStatus | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setAddModalOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredContacts = useMemo(() => {
    const filtered = vendors.filter((contact) => {
      const q = search.toLowerCase()
      const matchesSearch =
        search === '' ||
        contact.name.toLowerCase().includes(q) ||
        (contact.contact_name ?? '').toLowerCase().includes(q) ||
        (contact.email ?? '').toLowerCase().includes(q) ||
        (contact.phone ?? '').toLowerCase().includes(q) ||
        (CATEGORY_LABELS[contact.category] ?? '').toLowerCase().includes(q)

      const matchesCategory = categoryFilter === null || contact.category === categoryFilter
      const matchesStatus = statusFilter === null || contact.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })

    return filtered.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1
      const valA = a[sortField] ?? ''
      const valB = b[sortField] ?? ''
      if (valA < valB) return -1 * dir
      if (valA > valB) return 1 * dir
      return 0
    })
  }, [vendors, search, categoryFilter, statusFilter, sortField, sortDirection])

  const handleAddContact = async (
    data: Omit<Contact, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => {
    await createContact.mutateAsync(data)
    toast('Contact added')
    setAddModalOpen(false)
  }

  const handleSaveContact = async (
    data: Omit<Contact, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => {
    const existing = vendors.find((v) => v.id === data.id)
    if (!existing) return
    const updated = { ...existing, ...data } as Contact
    await updateContact.mutateAsync(updated)
    setSelectedContact(updated)
    toast('Contact updated')
  }

  const handleDeleteContact = async (id: string) => {
    await deleteContact.mutateAsync(id)
    setSelectedContact(null)
    toast('Contact deleted')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-6 flex-shrink-0">
        <ContactsHeader
          vendors={vendors}
          onAddClick={() => setAddModalOpen(true)}
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
          onFilterChange={(filter) => {
            if (filter === null) {
              setCategoryFilter(null)
              setStatusFilter(null)
            } else if (filter.type === 'category') {
              setCategoryFilter(filter.value)
              setStatusFilter(null)
            } else {
              setStatusFilter(filter.value)
              setCategoryFilter(null)
            }
          }}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field, direction) => {
            setSortField(field)
            setSortDirection(direction)
          }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6">
        <ContactsList
          vendors={filteredContacts}
          onRowClick={(contact) => setSelectedContact(contact)}
          loading={isLoading}
        />
      </div>

      <ContactProfile
        vendor={selectedContact}
        onClose={() => setSelectedContact(null)}
        onSave={handleSaveContact}
        onDelete={handleDeleteContact}
        loading={updateContact.isPending || deleteContact.isPending}
      />

      <ContactModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddContact}
        onDelete={() => {}}
        loading={createContact.isPending}
      />

      {/* Mobile FAB — hidden when profile panel is open */}
      {!selectedContact && (
        <button
          onClick={() => setAddModalOpen(true)}
          className="sm:hidden fixed bottom-6 right-6 z-40 w-11 h-11 bg-black text-white rounded-full shadow-xl flex items-center justify-center hover:bg-neutral-800 active:scale-95 transition cursor-pointer"
        >
          <Plus size={18} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
