/**
 * Shared engine for the Quotes and Invoices template tabs.
 *
 * Both tabs are the same product surface — a drag-sortable master list
 * of named line-item templates with a read-only preview pane, an edit
 * modal, a starter catalog, duplicate / confirm-delete actions, and an
 * "Add from…" seeding picker — so one component owns all of it,
 * parameterised by {@link TemplateKind} and a copy pack. Persistence
 * lives in {@link createTemplateStore}; the thin per-tab wrappers only
 * supply copy, icons, and starter actions.
 *
 * @module app/(dashboard)/templates/line-item-template-manager
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
import { Plus, GripVertical, Library, Copy, Pencil, Trash2, type LucideIcon } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { formatAUD } from '@/lib/payments/format'
import type { StarterLineItemSet } from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

import { LineItemPreview } from './line-item-preview'
import { StarterCatalogModal } from './starter-catalog-modal'
import { TemplateEditForm, type TemplateFormValue, type TemplateSource } from './template-edit-form'
import { createTemplateStore, type TemplateKind, type TemplateRecord, type StoredItem } from './template-store'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesTwoPane } from './templates-two-pane'

/** A template row plus the counts the list displays. */
type TemplateListRow = TemplateRecord & { item_count: number; total: number }

/** "Edited X ago" meta line for the detail card. */
function EditedLine({ updatedAt }: { updatedAt?: string | null }) {
  // Capture "now" once at mount via a lazy initializer (Date.now() during
  // render is impure); the relative time recomputes from props.
  const [nowMs] = useState(() => Date.now())
  if (!updatedAt) return null
  return <p className="text-xs text-text-muted">Edited {formatRelativeTime(updatedAt, nowMs)}</p>
}

/** Per-tab wording so both tabs read naturally from one component. */
export interface LineItemTemplateManagerCopy {
  /** Toast subject — "Template" / "Invoice template". */
  toastNoun: string
  searchPlaceholder: string
  namePlaceholder: string
  newTemplateTitle: string
  editTemplateTitle: string
  /** Subtitle under the edit modal's title. */
  modalSubtitle: string
  /** Eyebrow label on the detail card — "Quote template" / "Invoice template". */
  eyebrow: string
  starterTitle: string
  starterBlurb: string
  emptyTitle: string
  emptyDescription: string
}

export interface LineItemTemplateManagerProps {
  kind: TemplateKind
  copy: LineItemTemplateManagerCopy
  emptyIcon: LucideIcon
  starterCatalog: readonly StarterLineItemSet[]
  /** Server action wrapper: adds the picked starters, returns the count. */
  onAddStarters: (names: string[]) => Promise<number>
}

function TemplateRow({
  template,
  selected,
  onSelect,
  disabled,
}: {
  template: TemplateListRow
  selected: boolean
  onSelect: (id: string) => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl pr-2 transition ${selected ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}
    >
      {!disabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reorder template"
          className="shrink-0 cursor-grab pl-1 text-text-subtle transition active:cursor-grabbing"
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelect(template.id)}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{template.name}</span>
          <span className="block truncate text-xs text-text-subtle">{template.notes || ''}</span>
        </span>
        <span className="shrink-0 text-right">
          {template.total > 0 ? (
            <span className="block text-sm font-medium tabular-nums text-text">{formatAUD(template.total)}</span>
          ) : null}
          <span className="block text-xs text-text-muted">
            {template.item_count} item{template.item_count !== 1 ? 's' : ''}
          </span>
        </span>
      </button>
    </div>
  )
}

/**
 * Master-detail manager for one line-item template kind.
 */
export function LineItemTemplateManager({
  kind,
  copy,
  emptyIcon,
  starterCatalog,
  onAddStarters,
}: LineItemTemplateManagerProps) {
  const supabase = createClient()
  const store = createTemplateStore(supabase, kind)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showStarters, setShowStarters] = useState(false)
  const [localTemplates, setLocalTemplates] = useState<TemplateListRow[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    void getUser()
    // Run once on mount — the Supabase client is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: templates, isLoading } = useQuery({
    queryKey: ['line-item-templates', kind],
    queryFn: () => store.list(userId!),
    enabled: !!userId,
  })

  const { data: allItems } = useQuery({
    queryKey: ['line-item-template-items', kind],
    queryFn: () => store.listItems(userId!),
    enabled: !!userId,
  })

  // Seeding sources for the edit form's "Add from…" picker: packages.
  const { data: sources = [] } = useQuery({
    queryKey: ['template-sources', kind],
    queryFn: async (): Promise<TemplateSource[]> => {
      if (!userId) return []
      const [pkgs, pkgItems] = await Promise.all([
        supabase.from('packages').select('id, name, archived_at').eq('user_id', userId).order('position'),
        supabase.from('package_items').select('package_id, description, amount, position').eq('user_id', userId).order('position'),
      ])
      const byPkg: Record<string, { description: string; amount: number }[]> = {}
      for (const it of pkgItems.data ?? []) (byPkg[it.package_id] ??= []).push({ description: it.description, amount: it.amount })
      return [
        // Archived packages leave every picker, matching the builders.
        ...(pkgs.data ?? [])
          .filter((p) => !p.archived_at)
          .map((p) => ({ id: p.id, kind: 'package' as const, name: p.name, items: byPkg[p.id] ?? [] })),
      ]
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (templates) {
      setLocalTemplates(
        templates.map((t) => {
          const items = allItems?.[t.id] ?? []
          return { ...t, item_count: items.length, total: items.reduce((sum, item) => sum + (item.amount || 0), 0) }
        }),
      )
    }
  }, [templates, allItems])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['line-item-templates', kind] })
    queryClient.invalidateQueries({ queryKey: ['line-item-template-items', kind] })
    // Builders list these templates as apply-sources; keep them fresh.
    queryClient.invalidateQueries({ queryKey: ['builder-apply-sources'] })
    if (kind === 'quote') queryClient.invalidateQueries({ queryKey: ['template-sources', 'invoice'] })
  }

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValue) => {
      if (!userId) throw new Error('User not authenticated')
      return store.create(userId, data, ((templates?.length ?? 0) + 1) * 1000)
    },
    onSuccess: (newId) => {
      invalidate()
      setIsCreating(false)
      setSelectedId(newId)
      toast(`${copy.toastNoun} created.`)
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to create template', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormValue & { id: string }) => {
      if (!userId) throw new Error('User not authenticated')
      await store.update(userId, data.id, data)
    },
    onSuccess: () => {
      invalidate()
      setEditingId(null)
      toast(`${copy.toastNoun} updated.`)
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update template', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('User not authenticated')
      await store.remove(userId, id)
    },
    onSuccess: () => {
      invalidate()
      setConfirmDeleteId(null)
      toast(`${copy.toastNoun} deleted.`)
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to delete template', 'error'),
  })

  const duplicateMutation = useMutation({
    mutationFn: async (source: TemplateListRow) => {
      if (!userId) throw new Error('User not authenticated')
      // Place the copy directly after its source in the position order.
      return store.create(
        userId,
        {
          name: `${source.name} (copy)`,
          notes: source.notes,
          description: source.description,
          items: (allItems?.[source.id] ?? []).map(({ description, amount }) => ({ description, amount })),
        },
        source.position + 1,
      )
    },
    onSuccess: (newId) => {
      invalidate()
      setSelectedId(newId)
      toast(`${copy.toastNoun} duplicated.`)
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to duplicate template', 'error'),
  })

  const reorderMutation = useMutation({
    mutationFn: async (reordered: TemplateListRow[]) => {
      if (!userId) throw new Error('User not authenticated')
      await store.setPositions(userId, reordered.map((t) => t.id))
    },
    onSuccess: () => invalidate(),
    onError: (err) => {
      // Resync the optimistic local order with what actually persisted.
      invalidate()
      toast(err instanceof Error ? err.message : 'Failed to reorder templates', 'error')
    },
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localTemplates.findIndex((t) => t.id === active.id)
    const newIndex = localTemplates.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(localTemplates, oldIndex, newIndex)
    setLocalTemplates(reordered)
    await reorderMutation.mutateAsync(reordered)
  }

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const added = await onAddStarters(names)
    invalidate()
    return added
  }

  const handleSave = async (data: TemplateFormValue) => {
    if (editingId) await updateMutation.mutateAsync({ id: editingId, ...data })
    else await createMutation.mutateAsync(data)
  }

  const isSearching = search.trim().length > 0
  const q = search.trim().toLowerCase()
  // Search the whole template, not just its name: subtitle, applied
  // notes, and item descriptions all identify a template to an MC.
  const matches = (t: TemplateListRow) => {
    if (t.name.toLowerCase().includes(q)) return true
    if (t.notes?.toLowerCase().includes(q)) return true
    if (t.description?.toLowerCase().includes(q)) return true
    return (allItems?.[t.id] ?? []).some((item: StoredItem) => item.description.toLowerCase().includes(q))
  }
  const visible = isSearching ? localTemplates.filter(matches) : localTemplates

  const editing = localTemplates.find((t) => t.id === editingId)

  const takenNames = (excludeId: string | null) =>
    new Set(localTemplates.filter((t) => t.id !== excludeId).map((t) => t.name.toLowerCase()))

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

  const existingNames = new Set(localTemplates.map((t) => t.name))

  const effectiveId =
    selectedId && localTemplates.some((t) => t.id === selectedId) ? selectedId : (localTemplates[0]?.id ?? null)
  const selectedTpl = localTemplates.find((t) => t.id === effectiveId) ?? null
  const confirmTpl = localTemplates.find((t) => t.id === confirmDeleteId)

  return (
    <div className="flex h-full flex-col">
      <TemplatesActions>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.searchPlaceholder}
          size="sm"
          className="w-36 sm:w-48"
        />
        <Button size="sm" variant="outline" onClick={() => setShowStarters(true)} className="gap-1.5">
          <Library size={14} strokeWidth={1.5} />
          Browse starters
        </Button>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus size={14} strokeWidth={1.5} />
          New Template
        </Button>
      </TemplatesActions>

      {isCreating && (
        <TemplateEditForm
          title={copy.newTemplateTitle}
          subtitle={copy.modalSubtitle}
          namePlaceholder={copy.namePlaceholder}
          value={{ name: '', notes: null, description: null, items: [] }}
          sources={sources}
          takenNames={takenNames(null)}
          onSave={handleSave}
          onClose={() => setIsCreating(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {editingId && editing && (
        <TemplateEditForm
          key={editingId}
          title={copy.editTemplateTitle}
          subtitle={copy.modalSubtitle}
          namePlaceholder={copy.namePlaceholder}
          value={{
            name: editing.name,
            notes: editing.notes,
            description: editing.description,
            items: allItems?.[editingId] ?? [],
          }}
          sources={sources}
          takenNames={takenNames(editingId)}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
          isSaving={updateMutation.isPending}
        />
      )}

      <StarterCatalogModal
        isOpen={showStarters}
        onClose={() => setShowStarters(false)}
        title={copy.starterTitle}
        blurb={copy.starterBlurb}
        noun="template"
        catalog={starterCatalog}
        existingNames={existingNames}
        onAdd={handleAddStarters}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete template?"
        description={`This permanently deletes "${confirmTpl?.name ?? 'this template'}" and its line items. Quotes and invoices already created from it keep their copy.`}
        onConfirm={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        loading={deleteMutation.isPending}
      />

      {localTemplates.length === 0 ? (
        <div className="flex flex-1 items-center justify-center pb-[10vh]">
          <Empty
            size="sm"
            icon={emptyIcon}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
          />
        </div>
      ) : (
        <TemplatesTwoPane
          selected={!!selectedId}
          onBack={() => setSelectedId(null)}
          list={
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {visible.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-subtle">No matches.</p>
                ) : (
                  <div className="space-y-1">
                    {visible.map((template) => (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        selected={template.id === effectiveId}
                        onSelect={setSelectedId}
                        disabled={isSearching}
                      />
                    ))}
                  </div>
                )}
              </SortableContext>
            </DndContext>
          }
          detail={
            selectedTpl ? (
              <LineItemPreview
                eyebrow={copy.eyebrow}
                name={selectedTpl.name}
                subtitle={selectedTpl.notes}
                meta={<EditedLine updatedAt={selectedTpl.updated_at} />}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setIsCreating(false)
                        setEditingId(selectedTpl.id)
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
                          onSelect: () => duplicateMutation.mutate(selectedTpl),
                        },
                        {
                          label: 'Delete',
                          destructive: true,
                          icon: <Trash2 size={15} strokeWidth={1.5} />,
                          onSelect: () => setConfirmDeleteId(selectedTpl.id),
                        },
                      ]}
                    />
                  </>
                }
                items={allItems?.[selectedTpl.id] ?? []}
                notes={selectedTpl.description}
              />
            ) : (
              <div className="flex h-full items-center justify-center pb-[10vh]">
                <p className="text-sm text-text-subtle">Select a template to preview.</p>
              </div>
            )
          }
        />
      )}
    </div>
  )
}
