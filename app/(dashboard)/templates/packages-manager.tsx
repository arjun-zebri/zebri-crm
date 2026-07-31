/**
 * Packages tab — reusable service bundles.
 *
 * A package is a named set of priced line items (plus optional add-ons
 * and pricing terms: booking deposit, weekend loading, GST-inclusive
 * flag) the MC drops into quotes and invoices. A master list selects a
 * package; the detail pane previews it read-only with conversion stats
 * and duplicate / archive / confirm-delete actions.
 * Backed by `packages` / `package_items` (owner-scoped RLS).
 *
 * @module app/(dashboard)/templates/packages-manager
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Copy, Library, Package as PackageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { packageTotals } from '@/lib/payments/package-math'
import { STARTER_PACKAGES } from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

import { categoryColorClasses } from './category-colors'
import { PackageEditForm, type PackageDraft, type PackageFormValue } from './package-edit-form'
import { PackagePreview } from './package-preview'
import { addStarterPackagesAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesTwoPane } from './templates-two-pane'
import { usePackageCategories } from './use-package-categories'

/** A single priced line item within a package. */
interface PackageItem {
  id: string
  description: string
  amount: number
  /** Unit count; rows created before packages v2 read as null → 1. */
  quantity: number | null
  /** True for an optional add-on offered alongside the base package. */
  optional: boolean | null
}

/** A package summary row (counts/total derived from its items). */
interface Package {
  id: string
  name: string
  description: string | null
  notes: string | null
  /** User category (see `package_categories`); null = uncategorised. */
  category_id: string | null
  position: number
  updated_at: string | null
  gst_inclusive: boolean | null
  archived_at: string | null
  weekend_loading_percent: number | null
  is_popular: boolean | null
  item_count?: number
  total?: number
}

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
  const archived = !!pkg.archived_at

  return (
    <div
      className={`group flex items-center gap-2 rounded-xl px-2 transition ${selected ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}
    >
      <button
        type="button"
        onClick={() => onSelect(pkg.id)}
        aria-current={selected ? 'true' : undefined}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 text-left ${archived ? 'opacity-60' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{pkg.name}</span>
          <span className="block truncate text-xs text-text-subtle">{pkg.notes || ''}</span>
        </span>
        <span className="shrink-0 text-right">
          {(pkg.total ?? 0) > 0 ? (
            <span className="block text-sm font-medium tabular-nums text-text">{formatCurrency(pkg.total ?? 0)}</span>
          ) : null}
          <span className="block text-xs text-text-muted">
            {pkg.item_count || 0} item{(pkg.item_count || 0) !== 1 ? 's' : ''}
          </span>
        </span>
      </button>
    </div>
  )
}

/** Meta line for the detail card: "Edited X ago". */
function PackageCaption({ updatedAt }: { updatedAt?: string | null }) {
  // Capture "now" once at mount via a lazy initializer (Date.now() during
  // render is impure); the relative "Edited X ago" recomputes from props.
  const [nowMs] = useState(() => Date.now())

  if (!updatedAt) return null

  return (
    <p className="text-xs text-text-muted">Edited {formatRelativeTime(updatedAt, nowMs)}</p>
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const isSearching = search.trim().length > 0
  const matches = (p: Package) => p.name.toLowerCase().includes(search.trim().toLowerCase())
  const active = localPackages.filter((p) => !p.archived_at)
  const archived = localPackages.filter((p) => !!p.archived_at)
  const visibleActive = isSearching ? active.filter(matches) : active
  const visibleArchived = isSearching ? archived.filter(matches) : archived

  const { data: categories = [] } = usePackageCategories()

  // Group active packages by category (user drag order + trailing
  // "Uncategorised"), like the Emails library. With no categories at
  // all the list stays flat — a lone "Uncategorised" header is noise.
  const known = new Set(categories.map((c) => c.id))
  const groups = [
    ...categories.map((c) => ({
      key: c.id,
      label: c.name,
      dotClass: categoryColorClasses(c.color).dot,
      items: visibleActive.filter((p) => p.category_id === c.id),
    })),
    {
      key: 'uncategorised',
      label: 'Uncategorised',
      dotClass: null as string | null,
      items: visibleActive.filter((p) => !p.category_id || !known.has(p.category_id)),
    },
  ].filter((g) => g.items.length > 0)
  const showGroupHeaders = categories.length > 0

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
        ;(grouped[item.package_id] ??= []).push({
          id: item.id,
          description: item.description,
          amount: item.amount,
          quantity: item.quantity ?? null,
          optional: item.optional ?? null,
        })
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
          // The list row shows the base price; add-ons are extras.
          return { ...p, item_count: items.length, total: packageTotals(items).base }
        }),
      )
    }
  }, [packages, allItems])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['packages'] })
    queryClient.invalidateQueries({ queryKey: ['package-items'] })
  }

  /** Rows for a bulk `package_items` insert. Keys must be uniform on
   *  every row or PostgREST silently drops the request. */
  const itemRows = (packageId: string, uid: string, items: PackageDraft['items']) =>
    items.map((item, i) => ({
      package_id: packageId,
      user_id: uid,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity || 1,
      optional: item.optional,
      position: (i + 1) * 1000,
    }))

  const createMutation = useMutation({
    mutationFn: async (draft: PackageDraft) => {
      if (!userId) throw new Error('User not authenticated')
      const { data: pkg, error: insertError } = await supabase
        .from('packages')
        .insert({
          user_id: userId,
          name: draft.name,
          notes: draft.notes,
          description: draft.description,
          category_id: draft.category_id,
          gst_inclusive: draft.gst_inclusive,
          weekend_loading_percent: draft.weekend_loading_percent,
          is_popular: draft.is_popular,
          position: (packages?.length ?? 0) * 1000,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      if (draft.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('package_items')
          .insert(itemRows(pkg.id, userId, draft.items))
        if (itemsError) throw itemsError
      }
      return pkg
    },
    onSuccess: () => {
      invalidate()
      setIsCreating(false)
      toast('Package created.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to create package', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: PackageDraft }) => {
      if (!userId) throw new Error('User not authenticated')
      const { error: updateError } = await supabase
        .from('packages')
        .update({
          name: draft.name,
          notes: draft.notes,
          description: draft.description,
          category_id: draft.category_id,
          gst_inclusive: draft.gst_inclusive,
          weekend_loading_percent: draft.weekend_loading_percent,
          is_popular: draft.is_popular,
          // No touch trigger on packages; set explicitly so the
          // preview's "Edited X ago" reflects edits, not creation.
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
      if (updateError) throw updateError

      // Wipe-and-reinsert keeps the form's ordering + section split as
      // the source of truth without resolving row deltas. Nothing
      // references package_items (quotes/invoices snapshot by copy),
      // so regenerated ids are harmless. Same pattern as saveQuoteAction.
      const { error: deleteError } = await supabase
        .from('package_items')
        .delete()
        .eq('package_id', id)
        .eq('user_id', userId)
      if (deleteError) throw deleteError
      if (draft.items.length > 0) {
        const { error: insertError } = await supabase
          .from('package_items')
          .insert(itemRows(id, userId, draft.items))
        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      invalidate()
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
      invalidate()
      setConfirmDeleteId(null)
      toast('Package deleted.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to delete package', 'error'),
  })

  const duplicateMutation = useMutation({
    mutationFn: async (source: Package) => {
      if (!userId) throw new Error('User not authenticated')
      // Place the copy directly after its source in the position order.
      const { data: pkg, error: insertError } = await supabase
        .from('packages')
        .insert({
          user_id: userId,
          name: `${source.name} (copy)`,
          description: source.description,
          notes: source.notes,
          category_id: source.category_id,
          gst_inclusive: source.gst_inclusive ?? true,
          weekend_loading_percent: source.weekend_loading_percent,
          position: source.position + 1,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const items = allItems?.[source.id] ?? []
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('package_items').insert(
          items.map((item, i) => ({
            package_id: pkg.id,
            user_id: userId,
            description: item.description,
            amount: item.amount,
            quantity: item.quantity ?? 1,
            optional: !!item.optional,
            position: (i + 1) * 1000,
          })),
        )
        if (itemsError) throw itemsError
      }
      return pkg.id as string
    },
    onSuccess: (newId) => {
      invalidate()
      setSelectedId(newId)
      toast('Package duplicated.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to duplicate package', 'error'),
  })

  const archiveMutation = useMutation({
    mutationFn: async (pkg: Package) => {
      if (!userId) throw new Error('User not authenticated')
      const { error } = await supabase
        .from('packages')
        .update({ archived_at: pkg.archived_at ? null : new Date().toISOString() })
        .eq('id', pkg.id)
        .eq('user_id', userId)
      if (error) throw error
      return !pkg.archived_at
    },
    onSuccess: (nowArchived) => {
      invalidate()
      if (nowArchived) setShowArchived(true)
      toast(nowArchived ? 'Package archived.' : 'Package restored.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update package', 'error'),
  })

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const res = await addStarterPackagesAction(names)
    if (!res.ok) throw new Error(res.error)
    invalidate()
    return res.data.added
  }

  const handleSave = async (draft: PackageDraft) => {
    if (editingId) await updateMutation.mutateAsync({ id: editingId, draft })
    else await createMutation.mutateAsync(draft)
  }

  const toFormValue = (pkg: Package): PackageFormValue => ({
    name: pkg.name,
    notes: pkg.notes,
    description: pkg.description,
    category_id: pkg.category_id,
    gst_inclusive: pkg.gst_inclusive ?? true,
    weekend_loading_percent: pkg.weekend_loading_percent,
    is_popular: pkg.is_popular ?? false,
    items: (allItems?.[pkg.id] ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity ?? 1,
      optional: !!item.optional,
    })),
  })

  const editing = localPackages.find((t) => t.id === editingId)

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
    selectedId && localPackages.some((t) => t.id === selectedId) ? selectedId : (active[0]?.id ?? null)
  const selectedPkg = localPackages.find((t) => t.id === effectiveId) ?? null

  const emptyForm: PackageFormValue = {
    name: '',
    notes: null,
    description: null,
    category_id: null,
    gst_inclusive: true,
    weekend_loading_percent: null,
    is_popular: false,
    items: [],
  }

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

      {isCreating && (
        <PackageEditForm
          title="New Package"
          value={emptyForm}
          onSave={handleSave}
          onClose={() => setIsCreating(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {editingId && editing && (
        <PackageEditForm
          key={editingId}
          title="Edit Package"
          value={toFormValue(editing)}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
          isSaving={updateMutation.isPending}
        />
      )}

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

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete package?"
        description={`This permanently deletes "${localPackages.find((p) => p.id === confirmDeleteId)?.name ?? 'this package'}" and its line items. Quotes and invoices already created from it keep their copy. Archiving keeps it out of the way without losing it.`}
        onConfirm={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        loading={deleteMutation.isPending}
      />

      {localPackages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center pb-[10vh]">
          <Empty
            size="sm"
            icon={PackageIcon}
            title="No packages yet"
            description="Save the services you sell as reusable packages, then drop them straight into quotes and invoices."
          />
        </div>
      ) : (
        <TemplatesTwoPane
          selected={!!selectedId}
          onBack={() => setSelectedId(null)}
          list={
            <>
              {visibleActive.length === 0 && visibleArchived.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-subtle">No matches.</p>
              ) : showGroupHeaders ? (
                <div className="space-y-5">
                  {groups.map((group) => (
                    <section key={group.key}>
                      <h3 className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">
                        {group.dotClass && <span className={`h-2 w-2 rounded-full ${group.dotClass}`} />}
                        {group.label}
                      </h3>
                      <div className="mt-1 space-y-1">
                        {group.items.map((pkg) => (
                          <PackageRow
                            key={pkg.id}
                            pkg={pkg}
                            selected={pkg.id === effectiveId}
                            onSelect={setSelectedId}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {visibleActive.map((pkg) => (
                    <PackageRow
                      key={pkg.id}
                      pkg={pkg}
                      selected={pkg.id === effectiveId}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
              )}

              {archived.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className="flex items-center gap-1 py-1 text-xs text-text-muted transition hover:text-text cursor-pointer"
                  >
                    {showArchived ? (
                      <ChevronDown size={14} strokeWidth={1.5} />
                    ) : (
                      <ChevronRight size={14} strokeWidth={1.5} />
                    )}
                    Archived ({archived.length})
                  </button>
                  {showArchived && (
                    <div className="mt-1 space-y-1">
                      {visibleArchived.map((pkg) => (
                        <PackageRow
                          key={pkg.id}
                          pkg={pkg}
                          selected={pkg.id === effectiveId}
                          onSelect={setSelectedId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          }
          detail={
            selectedPkg ? (
              <PackagePreview
                name={selectedPkg.name}
                subtitle={selectedPkg.notes}
                archived={!!selectedPkg.archived_at}
                category={categories.find((c) => c.id === selectedPkg.category_id) ?? null}
                meta={<PackageCaption updatedAt={selectedPkg.updated_at} />}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setIsCreating(false)
                        setEditingId(selectedPkg.id)
                      }}
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                      Edit
                    </Button>
                    <RowActionsMenu
                      alwaysVisible
                      actions={[
                        {
                          label: 'Duplicate',
                          icon: <Copy size={15} strokeWidth={1.5} />,
                          onSelect: () => duplicateMutation.mutate(selectedPkg),
                        },
                        {
                          label: selectedPkg.archived_at ? 'Unarchive' : 'Archive',
                          icon: selectedPkg.archived_at ? (
                            <ArchiveRestore size={15} strokeWidth={1.5} />
                          ) : (
                            <Archive size={15} strokeWidth={1.5} />
                          ),
                          onSelect: () => archiveMutation.mutate(selectedPkg),
                        },
                        {
                          label: 'Delete',
                          destructive: true,
                          icon: <Trash2 size={15} strokeWidth={1.5} />,
                          onSelect: () => setConfirmDeleteId(selectedPkg.id),
                        },
                      ]}
                    />
                  </>
                }
                items={allItems?.[selectedPkg.id] ?? []}
                description={selectedPkg.description}
                gstInclusive={selectedPkg.gst_inclusive ?? true}
                weekendLoadingPercent={selectedPkg.weekend_loading_percent}
              />
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
