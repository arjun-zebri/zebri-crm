/**
 * Packages tab — reusable service bundles.
 *
 * A package is a named set of priced line items the MC can drop into a
 * quote or invoice. A master list selects a package; the detail pane
 * previews it read-only and the edit modal is a single-column form.
 * Backed by `packages` / `package_items` (owner-scoped RLS).
 *
 * @module app/(dashboard)/templates/packages-manager
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Package as PackageIcon, Library } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { STARTER_PACKAGES } from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/client'

import { LineItemPreview } from './line-item-preview'
import { addStarterPackagesAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'
import { TemplatePreviewHeader } from './template-preview-header'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesTwoPane } from './templates-two-pane'

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
  selected,
  onSelect,
}: {
  pkg: Package
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-xl px-2 transition ${selected ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}
    >
      <button
        type="button"
        onClick={() => onSelect(pkg.id)}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{pkg.name}</span>
          <span className="block truncate text-xs text-text-subtle">{pkg.notes || ''}</span>
        </span>
        <span className="shrink-0 text-right">
          {(pkg.total ?? 0) > 0 ? (
            <span className="block text-sm font-medium text-text">{formatCurrency(pkg.total ?? 0)}</span>
          ) : null}
          <span className="block text-xs text-text-muted">
            {pkg.item_count || 0} item{(pkg.item_count || 0) !== 1 ? 's' : ''}
          </span>
        </span>
      </button>
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
    <div className="space-y-5">
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
        <label className="block text-sm font-medium text-text mb-2">Line items</label>
        {items.length === 0 ? (
          <p className="text-sm text-text-subtle py-2">No items yet. Add one below.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <span className="flex-1 text-xs text-text-muted">Description</span>
              <span className="w-32 text-xs text-text-muted">Amount</span>
              <span className="w-8" />
            </div>
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="e.g., MC Ceremony"
                  disabled={isSaving}
                  size="sm"
                  className="flex-1"
                />
                <div className="flex w-32 items-center gap-1 rounded-xl border border-border bg-card px-3 py-2">
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
                  className="flex w-8 shrink-0 items-center justify-center p-2 text-text-subtle transition hover:text-danger cursor-pointer"
                  disabled={isSaving}
                  aria-label="Remove line item"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addItem}
          disabled={isSaving}
          className="mt-2 flex items-center gap-1 py-1 text-sm text-text-muted transition hover:text-text cursor-pointer disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add line item
        </button>

        {items.length > 0 && (
          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-text-muted">Total</span>
            <span className="text-sm font-semibold tabular-nums text-text">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end border-t border-border pt-4">
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
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const isSearching = search.trim().length > 0
  const visible = isSearching
    ? localPackages.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : localPackages

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
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-surface-muted rounded-xl" />
        ))}
      </div>
    )
  }

  const existingNames = new Set(localPackages.map((p) => p.name))

  const effectiveId =
    selectedId && localPackages.some((t) => t.id === selectedId) ? selectedId : (localPackages[0]?.id ?? null)
  const selectedPkg = localPackages.find((t) => t.id === effectiveId) ?? null

  return (
    <div className="flex h-full flex-col">
      <TemplatesActions>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search packages…"
          size="sm"
          className="w-36 sm:w-48"
        />
        <Button size="sm" variant="outline" onClick={() => setShowStarters(true)} className="gap-1.5">
          <Library size={14} strokeWidth={1.5} />
          Browse starters
        </Button>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus size={14} strokeWidth={1.5} />
          New Package
        </Button>
      </TemplatesActions>

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

      {localPackages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center pb-[10vh]">
          <Empty
            size="sm"
            icon={PackageIcon}
            title="No packages yet"
            description="Save a set of line items as a reusable package."
          />
        </div>
      ) : (
        <TemplatesTwoPane
          selected={!!selectedId}
          onBack={() => setSelectedId(null)}
          list={
            visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-subtle">No matches.</p>
            ) : (
              <div className="space-y-1">
                {visible.map((pkg) => (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    selected={pkg.id === effectiveId}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            )
          }
          detail={
            selectedPkg ? (
              <div className="space-y-4">
                <TemplatePreviewHeader
                  title={selectedPkg.name}
                  subtitle={selectedPkg.notes ?? undefined}
                  editLabel="Edit package"
                  onEdit={() => {
                    setIsCreating(false)
                    setEditingId(selectedPkg.id)
                  }}
                  onDelete={() => deleteMutation.mutate(selectedPkg.id)}
                />
                <LineItemPreview
                  name={selectedPkg.name}
                  items={allItems?.[selectedPkg.id] ?? []}
                  showHeader={false}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center pb-[10vh]">
                <p className="text-sm text-text-subtle">Select a package to preview.</p>
              </div>
            )
          }
        />
      )}
    </div>
  )
}
