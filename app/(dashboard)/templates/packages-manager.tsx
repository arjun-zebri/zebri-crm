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
import { Plus, Trash2, GripVertical, Pencil, Package as PackageIcon, Library } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { STARTER_PACKAGES } from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/client'

import { LineItemPreview } from './line-item-preview'
import { addStarterPackagesAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pkg.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-muted"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-text-subtle transition"
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      <button type="button" onClick={() => onEdit(pkg.id)} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className="truncate text-sm font-medium text-text">{pkg.name}</p>
        <p className="truncate text-xs text-text-subtle">{pkg.notes || ''}</p>
      </button>

      <div className="text-right shrink-0">
        {(pkg.total ?? 0) > 0 ? <p className="text-sm font-medium text-text">{formatCurrency(pkg.total ?? 0)}</p> : null}
        <p className="text-xs text-text-muted">
          {pkg.item_count || 0} item{(pkg.item_count || 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <RowActionsMenu
        alwaysVisible
        actions={[
          { label: 'Edit', icon: <Pencil size={15} strokeWidth={1.5} />, onSelect: () => onEdit(pkg.id) },
          {
            label: 'Delete',
            destructive: true,
            icon: <Trash2 size={15} strokeWidth={1.5} />,
            onSelect: () => onDelete(pkg.id),
          },
        ]}
      />
    </div>
  )
}

interface EditPackageFormProps {
  pkg: PackageWithItems
  onSave: (data: { name: string; notes: string | null; items: PackageItem[] }) => void
  onCancel: () => void
  isSaving: boolean
}

function EditPackageForm({ pkg, onSave, onCancel, isSaving }: EditPackageFormProps) {
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
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Package name <span className="text-danger">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Gold Package"
            disabled={isSaving}
            autoFocus
            size="sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Subtitle</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short description shown on the package list"
            disabled={isSaving}
            size="sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Line Items</label>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-xs text-text-subtle py-1">No items yet</p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 mb-1 px-0.5">
                  <span className="text-xs text-text-muted">Description</span>
                  <span className="text-xs text-text-muted w-28 text-right">Amount</span>
                  <span className="w-8" />
                </div>
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center">
                    <Input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="e.g., MC Ceremony"
                      disabled={isSaving}
                      size="sm"
                    />
                    <div className="flex items-center gap-1 border border-border rounded-xl px-3 py-2 bg-card w-28">
                      <span className="text-sm text-text-muted">$</span>
                      <input
                        type="number"
                        value={item.amount || ''}
                        onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                        placeholder="0"
                        step="0.01"
                        className={`w-full text-sm text-text bg-transparent focus:outline-none ${noArrowsClass}`}
                        disabled={isSaving}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-text-subtle hover:text-danger transition w-8 flex items-center justify-center cursor-pointer"
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
              className="text-sm text-text-muted hover:text-text transition cursor-pointer disabled:opacity-50 flex items-center gap-1 py-1"
            >
              <Plus size={14} strokeWidth={1.5} />
              Add line item
            </button>
          </div>

          {items.length > 0 && (
            <div className="flex justify-end pt-3 border-t border-border mt-3">
              <div className="text-right">
                <span className="text-xs text-text-muted mr-3">Total</span>
                <span className="text-sm font-semibold text-text">{formatCurrency(total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block">
        <LineItemPreview name={name} subtitle={notes} items={items} />
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-border col-span-full">
        <Button onClick={onCancel} disabled={isSaving} variant="outline" size="sm">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !name.trim()} size="sm">
          Save
        </Button>
      </div>
    </div>
  )
}

/**
 * Manages the display and editing of packages.
 */
export function PackagesManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showStarters, setShowStarters] = useState(false)
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

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const res = await addStarterPackagesAction(names)
    if (!res.ok) throw new Error(res.error)
    queryClient.invalidateQueries({ queryKey: ['packages'] })
    queryClient.invalidateQueries({ queryKey: ['package-items'] })
    return res.data.added
  }

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
          <div key={i} className="h-12 bg-surface-muted rounded-xl" />
        ))}
      </div>
    )
  }

  const existingNames = new Set(localPackages.map((p) => p.name))

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-text">Packages</h3>
          <p className="text-sm text-text-muted mt-1">Reusable service bundles you can drop into quotes and invoices.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowStarters(true)} className="gap-1.5">
            <Library size={14} strokeWidth={1.5} />
            Browse starters
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={14} strokeWidth={1.5} />
            New Package
          </Button>
        </div>
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

      <StarterCatalogModal
        isOpen={showStarters}
        onClose={() => setShowStarters(false)}
        title="Browse starter packages"
        blurb="Add the packages you want. Nothing is added unless you choose it."
        noun="package"
        catalog={STARTER_PACKAGES}
        existingNames={existingNames}
        onAdd={handleAddStarters}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localPackages.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localPackages.length === 0 ? (
              <Empty
                size="sm"
                className="min-h-[40vh]"
                icon={PackageIcon}
                title="No packages yet"
                description="Save a set of line items as a reusable package."
                action={
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowStarters(true)}>
                      Browse starter packages
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                      New Package
                    </Button>
                  </div>
                }
              />
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
