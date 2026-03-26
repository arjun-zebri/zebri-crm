'use client'

import { useEffect, useState, useMemo } from 'react'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | undefined>()
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setEditingContact(undefined)
          setModalOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredContacts = useMemo(() => {
    const filtered = vendors.filter((contact) => {
      const matchesSearch =
        search === '' ||
        contact.name.toLowerCase().includes(search.toLowerCase()) ||
        contact.contact_name.toLowerCase().includes(search.toLowerCase()) ||
        contact.email.toLowerCase().includes(search.toLowerCase()) ||
        contact.phone.toLowerCase().includes(search.toLowerCase()) ||
        CATEGORY_LABELS[contact.category].toLowerCase().includes(search.toLowerCase())

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

  const handleSaveContact = async (
    data: Omit<Contact, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => {
    if (data.id && editingContact) {
      const updated = { ...editingContact, ...data }
      await updateContact.mutateAsync(updated)
      if (selectedContact?.id === data.id) {
        setSelectedContact(updated)
      }
      toast('Contact updated')
    } else {
      await createContact.mutateAsync(data)
      toast('Contact added')
    }
    setModalOpen(false)
    setEditingContact(undefined)
  }

  const handleDeleteContact = async (id: string) => {
    await deleteContact.mutateAsync(id)
    setModalOpen(false)
    setEditingContact(undefined)
    if (selectedContact?.id === id) {
      setSelectedContact(null)
    }
    toast('Contact deleted')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <ContactsHeader
          vendors={vendors}
          onAddClick={() => {
            setEditingContact(undefined)
            setModalOpen(true)
          }}
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

      {/* Profile slide-over (z-40/50) — stays open behind the edit modal */}
      <ContactProfile
        vendor={selectedContact}
        onClose={() => setSelectedContact(null)}
        onEdit={(contact) => {
          setEditingContact(contact)
          setModalOpen(true)
        }}
      />

      {/* Edit/Add modal (z-50/60) — opens on top of everything */}
      <ContactModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingContact(undefined)
        }}
        onSave={handleSaveContact}
        onDelete={handleDeleteContact}
        vendor={editingContact}
        loading={
          createContact.isPending ||
          updateContact.isPending ||
          deleteContact.isPending
        }
      />
    </div>
  )
}
