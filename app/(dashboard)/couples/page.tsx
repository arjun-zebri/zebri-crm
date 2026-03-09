'use client'

import { useEffect, useState, useMemo } from 'react'
import { useCouples, useCreateCouple, useUpdateCouple, useDeleteCouple } from './use-couples'
import { CouplesHeader } from './couples-header'
import { CouplesToolbar } from './couples-toolbar'
import { CouplesList } from './couples-list'
import { CouplesKanban } from './couples-kanban'
import { CoupleModal } from './couple-modal'
import { Couple, ViewMode, CoupleStatus } from './couples-types'

export default function CouplesPage() {
  const { data: couples, isLoading } = useCouples()
  const createCouple = useCreateCouple()
  const updateCouple = useUpdateCouple()
  const deleteCouple = useDeleteCouple()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CoupleStatus | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCouple, setEditingCouple] = useState<Couple | undefined>()

  // Load view mode preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('zebri_couples_view')
    if (saved === 'kanban' || saved === 'list') {
      setViewMode(saved)
    }
  }, [])

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('zebri_couples_view', mode)
  }

  // Keyboard shortcut for adding couple
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setEditingCouple(undefined)
          setModalOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Filter couples based on search and status
  const filteredCouples = useMemo(() => {
    return couples.filter((couple) => {
      const matchesSearch =
        search === '' ||
        couple.name.toLowerCase().includes(search.toLowerCase()) ||
        couple.email.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'all' || couple.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [couples, search, statusFilter])

  const handleSaveCouple = async (data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string }) => {
    if (data.id && editingCouple) {
      // Update
      await updateCouple.mutateAsync({
        ...editingCouple,
        ...data,
      })
    } else {
      // Create
      await createCouple.mutateAsync(data)
    }
    setModalOpen(false)
    setEditingCouple(undefined)
  }

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id)
    setModalOpen(false)
    setEditingCouple(undefined)
  }

  const handleDragEnd = async (source: string, destination: string, coupleId: string) => {
    if (source === destination) return

    const couple = couples.find((c) => c.id === coupleId)
    if (!couple) return

    await updateCouple.mutateAsync({
      ...couple,
      status: destination as CoupleStatus,
    })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="space-y-4 px-6 pt-6 pb-3">
        <CouplesHeader
          couples={couples}
          onAddClick={() => {
            setEditingCouple(undefined)
            setModalOpen(true)
          }}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </div>

      <div className="px-6 pb-3">
        <CouplesToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          couples={couples}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6">
        {viewMode === 'list' ? (
          <CouplesList
            couples={filteredCouples}
            onRowClick={(couple) => {
              setEditingCouple(couple)
              setModalOpen(true)
            }}
            loading={isLoading}
          />
        ) : (
          <div className="h-full overflow-hidden">
            <CouplesKanban
              couples={filteredCouples}
              onCardClick={(couple) => {
                setEditingCouple(couple)
                setModalOpen(true)
              }}
              onDragEnd={handleDragEnd}
              onAddClick={() => {
                setEditingCouple(undefined)
                setModalOpen(true)
              }}
            />
          </div>
        )}
      </div>

      <CoupleModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingCouple(undefined)
        }}
        onSave={handleSaveCouple}
        onDelete={handleDeleteCouple}
        couple={editingCouple}
        loading={createCouple.isPending || updateCouple.isPending || deleteCouple.isPending}
      />
    </div>
  )
}
