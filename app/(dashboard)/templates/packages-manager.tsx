/**
 * Packages tab — reusable service bundles.
 *
 * A package is a named set of priced line items the MC can drop into a
 * quote or invoice. CRUD + drag-reorder, mirroring the Quotes tab so the
 * two sibling surfaces feel identical. Backed by `packages` /
 * `package_items` (owner-scoped RLS).
 *
 * @module app/(dashboard)/templates/packages-manager
 */
'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'

/** A single priced line item within a package. */
interface PackageItem {
  id: string
  description: string
  amount: number
}

/** A package summary row (counts/total derived from its items). */
interface Package {
  id: string
  name: string
  description: string | null
  notes: string | null
  position: number
  item_count?: number
  total?: number
}

interface PackageWithItems extends Package {
  items: PackageItem[]
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

const noArrowsClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

/** AUD — Zebri is an Australian product. */
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function PackageRow({
  pkg,
  onEdit,
  onDelete,
}: {
  pkg: Package
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pkg.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties

  if (confirmDelete) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
        <p className="flex-1 text-sm text-red-700">
          Delete <span className="font-medium">{pkg.name}</span>?
        </p>
        <button
          type="button"
          onClick={() => {
            onDelete(pkg.id)
            setConfirmDelete(false)
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-white transition cursor-pointer"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isDragging ? 'border-gray-300 bg-gray-50 shadow-lg' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition"
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">{pkg.name}</h4>
        {pkg.notes && <p className="text-xs text-gray-500 truncate mt-0.5">{pkg.notes}</p>}
      </div>

      <div className="text-right shrink-0">
        {(pkg.total ?? 0) > 0 ? <p className="text-sm font-medium text-gray-900">{formatCurrency(pkg.total ?? 0)}</p> : null}
        <p className="text-xs text-gray-400">
          {pkg.item_count || 0} item{(pkg.item_count || 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onEdit(pkg.id)}
        className="shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
      >
        <Pencil size={15} strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
      >
        <Trash2 size={15} strokeWidth={1.5} />
      </button>
    </div>
  )
}

function EditPackageForm({
  pkg,
  onSave,
  onCancel,
  isSaving,
}: {
  pkg: PackageWithItems
  onSave: (data: { name: string; notes: string | null; items: PackageItem[] }) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [name, setName] = useState(pkg.name)
  const [notes, setNotes] = useState(pkg.notes || '')
  const [items, setItems] = useState<PackageItem[]>(pkg.items)

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const addItem = () => setItems([...items, { id: `new-${Date.now()}`, description: '', amount: 0 }])

  const updateItem = (id: string, field: 'description' | 'amount', value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : item,
      ),
    )
  }

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id))

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), notes: notes.trim() || null, items })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Package name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Gold Package"
          className={inputClass}
          disabled={isSaving}
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Short description shown on the package list"
          className={inputClass}
          disabled={isSaving}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No items yet</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 mb-1 px-0.5">
                <span className="text-xs text-gray-400">Description</span>
                <span className="text-xs text-gray-400 w-28 text-right">Amount</span>
                <span className="w-8" />
              </div>
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="e.g., MC Ceremony"
                    className={inputClass}
                    disabled={isSaving}
                  />
                  <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2 bg-white w-28">
                    <span className="text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                      placeholder="0"
                      step="0.01"
                      className={`w-full text-sm text-gray-900 bg-transparent focus:outline-none ${noArrowsClass}`}
                      disabled={isSaving}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition w-8 flex items-center justify-center"
                    disabled={isSaving}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </>
          )}
          <button
            type="button"
            onClick={addItem}
            disabled={isSaving}
            className="text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 py-1"
          >
            <Plus size={14} strokeWidth={1.5} />
            Add line item
          </button>
        </div>

        {items.length > 0 && (
          <div className="flex justify-end pt-3 border-t border-gray-100 mt-3">
            <div className="text-right">
              <span className="text-xs text-gray-400 mr-3">Total</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-900 hover:bg-gray-50 transition disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="px-4 py-2 text-sm rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function PackagesManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [localPackages, setLocalPackages] = useState<Package[]>([])

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
    // Run once on mount — the Supabase client is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: packages, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as Package[]
    },
    enabled: !!userId,
  })

  const { data: allItems } = useQuery({
    queryKey: ['package-items'],
    queryFn: async () => {
      if (!userId) return {}
      const { data, error } = await supabase
        .from('package_items')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
      if (error) throw error
      const grouped: Record<string, PackageItem[]> = {}
      for (const item of data ?? []) {
        ;(grouped[item.package_id] ??= []).push({ id: item.id, description: item.description, amount: item.amount })
      }
      return grouped
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (packages) {
      setLocalPackages(
        packages.map((p) => {
          const items = allItems?.[p.id] || []
          return { ...p, item_count: items.length, total: items.reduce((sum, item) => sum + (item.amount || 0), 0) }
        }),
      )
    }
  }, [packages, allItems])

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; notes: string | null; items: PackageItem[] }) => {
      if (!userId) throw new Error('User not authenticated')
      const { data: pkg, error: insertError } = await supabase
        .from('packages')
        .insert({ user_id: userId, name: data.name, notes: data.notes, position: (packages?.length ?? 0) * 1000 })
        .select('id')
        .single()
      if (insertError) throw insertError
      if (data.items.length > 0) {
        const { error: itemsError } = await supabase.from('package_items').insert(
          data.items.map((item, i) => ({
            package_id: pkg.id,
            user_id: userId,
            description: item.description,
            amount: item.amount,
            position: (i + 1) * 1000,
          })),
        )
        if (itemsError) throw itemsError
      }
      return pkg
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      queryClient.invalidateQueries({ queryKey: ['package-items'] })
      setIsCreating(false)
      toast('Package created.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to create package', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; notes: string | null; items: PackageItem[] }) => {
      if (!userId) throw new Error('User not authenticated')
      const { error: updateError } = await supabase
        .from('packages')
        .update({ name: data.name, notes: data.notes })
        .eq('id', data.id)
        .eq('user_id', userId)
      if (updateError) throw updateError

      const oldItems = allItems?.[data.id] || []
      const itemsToDelete = oldItems.filter((oi) => !data.items.find((ni) => ni.id === oi.id))
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('package_items')
          .delete()
          .in('id', itemsToDelete.map((i) => i.id))
        if (deleteError) throw deleteError
      }

      const newItems = data.items.filter((i) => i.id.startsWith('new-'))
      if (newItems.length > 0) {
        const { error: insertError } = await supabase.from('package_items').insert(
          newItems.map((item, i) => ({
            package_id: data.id,
            user_id: userId,
            description: item.description,
            amount: item.amount,
            position: (oldItems.length + i + 1) * 1000,
          })),
        )
        if (insertError) throw insertError
      }

      const updatedItems = data.items.filter((i) => !i.id.startsWith('new-'))
      for (const item of updatedItems) {
        const { error: updateItemError } = await supabase
          .from('package_items')
          .update({ description: item.description, amount: item.amount })
          .eq('id', item.id)
        if (updateItemError) throw updateItemError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      queryClient.invalidateQueries({ queryKey: ['package-items'] })
      setEditingId(null)
      toast('Package updated.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update package', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('User not authenticated')
      const { error } = await supabase.from('packages').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      queryClient.invalidateQueries({ queryKey: ['package-items'] })
      toast('Package deleted.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to delete package', 'error'),
  })

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Package[]) => {
      if (!userId) throw new Error('User not authenticated')
      for (let i = 0; i < reordered.length; i++) {
        const row = reordered[i]
        if (!row) continue
        const { error } = await supabase
          .from('packages')
          .update({ position: (i + 1) * 1000 })
          .eq('id', row.id)
          .eq('user_id', userId)
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localPackages.findIndex((t) => t.id === active.id)
    const newIndex = localPackages.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(localPackages, oldIndex, newIndex)
    setLocalPackages(reordered)
    await reorderMutation.mutateAsync(reordered)
  }

  const handleSave = async (data: { name: string; notes: string | null; items: PackageItem[] }) => {
    if (editingId) await updateMutation.mutateAsync({ id: editingId, ...data })
    else await createMutation.mutateAsync(data)
  }

  const editing = localPackages.find((t) => t.id === editingId)
  const editingPackage: PackageWithItems | null =
    editingId && editing ? { ...editing, items: allItems?.[editingId] || [] } : null

  const openCreate = () => {
    setEditingId(null)
    setIsCreating(true)
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Packages</h3>
          <p className="text-sm text-gray-500 mt-1">Reusable service bundles you can drop into quotes and invoices.</p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 px-3 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={15} strokeWidth={1.5} />
          New Package
        </button>
      </div>

      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="New Package">
        <EditPackageForm
          pkg={{ id: 'new', name: '', description: null, notes: null, position: 0, items: [] }}
          onSave={handleSave}
          onCancel={() => setIsCreating(false)}
          isSaving={createMutation.isPending}
        />
      </Modal>

      <Modal isOpen={!!editingId} onClose={() => setEditingId(null)} title="Edit Package">
        {editingPackage && (
          <EditPackageForm
            pkg={editingPackage}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            isSaving={updateMutation.isPending}
          />
        )}
      </Modal>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localPackages.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localPackages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-500">No packages yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Save a set of line items as a reusable package</p>
                <button
                  onClick={openCreate}
                  className="px-3 py-2 text-sm rounded-xl bg-black text-white hover:bg-neutral-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  New Package
                </button>
              </div>
            ) : (
              localPackages.map((pkg) => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  onEdit={(id) => {
                    setIsCreating(false)
                    setEditingId(id)
                  }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
