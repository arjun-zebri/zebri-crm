'use client'

import { useEffect, useState, useMemo } from 'react'
import { useToast } from '@/components/ui/toast'
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
} from './use-vendors'
import { VendorsHeader } from './vendors-header'
import { VendorsList } from './vendors-list'
import { VendorModal } from './vendor-modal'
import { VendorProfile } from './vendor-profile'
import {
  Vendor,
  VendorCategory,
  VendorStatus,
  SortField,
  SortDirection,
  CATEGORY_LABELS,
} from './vendors-types'

export default function VendorsPage() {
  const { data: vendors, isLoading } = useVendors()
  const createVendor = useCreateVendor()
  const updateVendor = useUpdateVendor()
  const deleteVendor = useDeleteVendor()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<VendorCategory | null>(null)
  const [statusFilter, setStatusFilter] = useState<VendorStatus | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>()
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setEditingVendor(undefined)
          setModalOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredVendors = useMemo(() => {
    const filtered = vendors.filter((vendor) => {
      const matchesSearch =
        search === '' ||
        vendor.name.toLowerCase().includes(search.toLowerCase()) ||
        vendor.contact_name.toLowerCase().includes(search.toLowerCase()) ||
        vendor.email.toLowerCase().includes(search.toLowerCase()) ||
        vendor.phone.toLowerCase().includes(search.toLowerCase()) ||
        CATEGORY_LABELS[vendor.category].toLowerCase().includes(search.toLowerCase())

      const matchesCategory = categoryFilter === null || vendor.category === categoryFilter
      const matchesStatus = statusFilter === null || vendor.status === statusFilter

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

  const handleSaveVendor = async (
    data: Omit<Vendor, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => {
    if (data.id && editingVendor) {
      const updated = { ...editingVendor, ...data }
      await updateVendor.mutateAsync(updated)
      if (selectedVendor?.id === data.id) {
        setSelectedVendor(updated)
      }
      toast('Vendor updated')
    } else {
      await createVendor.mutateAsync(data)
      toast('Vendor added')
    }
    setModalOpen(false)
    setEditingVendor(undefined)
  }

  const handleDeleteVendor = async (id: string) => {
    await deleteVendor.mutateAsync(id)
    setModalOpen(false)
    setEditingVendor(undefined)
    if (selectedVendor?.id === id) {
      setSelectedVendor(null)
    }
    toast('Vendor deleted')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <VendorsHeader
          vendors={vendors}
          onAddClick={() => {
            setEditingVendor(undefined)
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
        <VendorsList
          vendors={filteredVendors}
          onRowClick={(vendor) => setSelectedVendor(vendor)}
          loading={isLoading}
        />
      </div>

      {/* Profile slide-over (z-40/50) — stays open behind the edit modal */}
      <VendorProfile
        vendor={selectedVendor}
        onClose={() => setSelectedVendor(null)}
        onEdit={(vendor) => {
          setEditingVendor(vendor)
          setModalOpen(true)
        }}
      />

      {/* Edit/Add modal (z-50/60) — opens on top of everything */}
      <VendorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingVendor(undefined)
        }}
        onSave={handleSaveVendor}
        onDelete={handleDeleteVendor}
        vendor={editingVendor}
        loading={
          createVendor.isPending ||
          updateVendor.isPending ||
          deleteVendor.isPending
        }
      />
    </div>
  )
}
