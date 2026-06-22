/**
 * Invoices tab — reusable invoice templates.
 *
 * An invoice template is a named set of priced line items. It can be
 * built from scratch or seeded by referencing a **package** or **quote
 * template** via the "Add from…" picker, which snapshots that source's
 * line items in (no live FK — later price edits to a package never
 * silently change a saved invoice template). Backed by
 * `invoice_templates` / `invoice_template_items` (owner-scoped RLS).
 *
 * @module app/(dashboard)/templates/invoice-templates-manager
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
import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical, Pencil, Package as PackageIcon, ChevronDown, Receipt, Library } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { STARTER_INVOICE_TEMPLATES } from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/client'

import { LineItemPreview } from './line-item-preview'
import { addStarterInvoiceTemplatesAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'

interface InvoiceItem {
  id: string
  description: string
  amount: number
}

interface InvoiceTemplate {
  id: string
  name: string
  description: string | null
  notes: string | null
  position: number
  item_count?: number
  total?: number
}

interface InvoiceTemplateWithItems extends InvoiceTemplate {
  items: InvoiceItem[]
}

/** A package or quote template whose items can be pulled into a template. */
interface TemplateSource {
  id: string
  kind: 'package' | 'quote'
  name: string
  items: { description: string; amount: number }[]
}

const noArrowsClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: InvoiceTemplate
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id })

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

      <button type="button" onClick={() => onEdit(template.id)} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className="truncate text-sm font-medium text-text">{template.name}</p>
        <p className="truncate text-xs text-text-subtle">{template.notes || ''}</p>
      </button>

      <div className="text-right shrink-0">
        {(template.total ?? 0) > 0 ? (
          <p className="text-sm font-medium text-text">{formatCurrency(template.total ?? 0)}</p>
        ) : null}
        <p className="text-xs text-text-muted">
          {template.item_count || 0} item{(template.item_count || 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <RowActionsMenu
        alwaysVisible
        actions={[
          { label: 'Edit', icon: <Pencil size={15} strokeWidth={1.5} />, onSelect: () => onEdit(template.id) },
          {
            label: 'Delete',
            destructive: true,
            icon: <Trash2 size={15} strokeWidth={1.5} />,
            onSelect: () => onDelete(template.id),
          },
        ]}
      />
    </div>
  )
}

/** One labelled group of pickable sources within {@link SourcePicker}. */
function SourceGroup({
  label,
  items,
  onPick,
}: {
  label: string
  items: TemplateSource[]
  onPick: (s: TemplateSource) => void
}) {
  if (items.length === 0) return null
  return (
    <>
      <p className="px-2 pt-2 pb-1 text-xs font-medium text-gray-400">{label}</p>
      {items.map((s) => (
        <button
          key={`${s.kind}-${s.id}`}
          type="button"
          onClick={() => onPick(s)}
          className="w-full flex items-center justify-between gap-3 text-left px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
        >
          <span className="text-sm text-gray-900 truncate">{s.name}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {s.items.length} item{s.items.length !== 1 ? 's' : ''}
          </span>
        </button>
      ))}
    </>
  )
}

/** "Add from…" popover — appends a package / quote template's items. */
function SourcePicker({ sources, onPick }: { sources: TemplateSource[]; onPick: (s: TemplateSource) => void }) {
  const [open, setOpen] = useState(false)
  if (sources.length === 0) return null
  const packages = sources.filter((s) => s.kind === 'package')
  const quotes = sources.filter((s) => s.kind === 'quote')
  const pick = (s: TemplateSource) => {
    onPick(s)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer py-1"
        >
          <PackageIcon size={14} strokeWidth={1.5} />
          Add from package or quote
          <ChevronDown size={13} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[90] w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto">
            <SourceGroup label="Packages" items={packages} onPick={pick} />
            <SourceGroup label="Quote templates" items={quotes} onPick={pick} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface EditInvoiceTemplateFormProps {
  template: InvoiceTemplateWithItems
  sources: TemplateSource[]
  onSave: (data: { name: string; notes: string | null; items: InvoiceItem[] }) => void
  onCancel: () => void
  isSaving: boolean
}

function EditInvoiceTemplateForm({ template, sources, onSave, onCancel, isSaving }: EditInvoiceTemplateFormProps) {
  const [name, setName] = useState(template.name)
  const [notes, setNotes] = useState(template.notes || '')
  const [items, setItems] = useState<InvoiceItem[]>(template.items)

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const addItem = () => setItems([...items, { id: `new-${Date.now()}`, description: '', amount: 0 }])

  const addFromSource = (s: TemplateSource) => {
    const base = Date.now()
    setItems((prev) => [
      ...prev,
      ...s.items.map((it, i) => ({ id: `new-${base}-${i}`, description: it.description, amount: it.amount })),
    ])
  }

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
            Template name <span className="text-danger">*</span>
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Final balance invoice"
            disabled={isSaving}
            autoFocus
            size="sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Subtitle</label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short description shown on the template list"
            disabled={isSaving}
            size="sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-text">Line Items</label>
            <SourcePicker sources={sources} onPick={addFromSource} />
          </div>
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
                      placeholder="e.g., Final balance"
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
 * Manages the display and editing of invoice templates.
 */
export function InvoiceTemplatesManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showStarters, setShowStarters] = useState(false)
  const [localTemplates, setLocalTemplates] = useState<InvoiceTemplate[]>([])

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

  const { data: templates, isLoading } = useQuery({
    queryKey: ['invoice-templates'],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as InvoiceTemplate[]
    },
    enabled: !!userId,
  })

  const { data: allItems } = useQuery({
    queryKey: ['invoice-template-items'],
    queryFn: async () => {
      if (!userId) return {}
      const { data, error } = await supabase
        .from('invoice_template_items')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
      if (error) throw error
      const grouped: Record<string, InvoiceItem[]> = {}
      for (const item of data ?? []) {
        ;(grouped[item.invoice_template_id] ??= []).push({
          id: item.id,
          description: item.description,
          amount: item.amount,
        })
      }
      return grouped
    },
    enabled: !!userId,
  })

  // Referenceable sources: packages + quote templates with their items.
  const { data: sources = [] } = useQuery({
    queryKey: ['invoice-template-sources'],
    queryFn: async (): Promise<TemplateSource[]> => {
      if (!userId) return []
      const [pkgs, pkgItems, quotes, quoteItems] = await Promise.all([
        supabase.from('packages').select('id, name').eq('user_id', userId).order('position'),
        supabase.from('package_items').select('package_id, description, amount, position').eq('user_id', userId).order('position'),
        supabase.from('quote_templates').select('id, name').eq('user_id', userId).order('position'),
        supabase.from('quote_template_items').select('template_id, description, amount, position').eq('user_id', userId).order('position'),
      ])
      const byPkg: Record<string, { description: string; amount: number }[]> = {}
      for (const it of pkgItems.data ?? []) (byPkg[it.package_id] ??= []).push({ description: it.description, amount: it.amount })
      const byQuote: Record<string, { description: string; amount: number }[]> = {}
      for (const it of quoteItems.data ?? []) (byQuote[it.template_id] ??= []).push({ description: it.description, amount: it.amount })
      return [
        ...(pkgs.data ?? []).map((p) => ({ id: p.id, kind: 'package' as const, name: p.name, items: byPkg[p.id] ?? [] })),
        ...(quotes.data ?? []).map((q) => ({ id: q.id, kind: 'quote' as const, name: q.name, items: byQuote[q.id] ?? [] })),
      ]
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (templates) {
      setLocalTemplates(
        templates.map((t) => {
          const items = allItems?.[t.id] || []
          return { ...t, item_count: items.length, total: items.reduce((sum, item) => sum + (item.amount || 0), 0) }
        }),
      )
    }
  }, [templates, allItems])

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; notes: string | null; items: InvoiceItem[] }) => {
      if (!userId) throw new Error('User not authenticated')
      const { data: tpl, error: insertError } = await supabase
        .from('invoice_templates')
        .insert({ user_id: userId, name: data.name, notes: data.notes, position: (templates?.length ?? 0) * 1000 })
        .select('id')
        .single()
      if (insertError) throw insertError
      if (data.items.length > 0) {
        const { error: itemsError } = await supabase.from('invoice_template_items').insert(
          data.items.map((item, i) => ({
            invoice_template_id: tpl.id,
            user_id: userId,
            description: item.description,
            amount: item.amount,
            position: (i + 1) * 1000,
          })),
        )
        if (itemsError) throw itemsError
      }
      return tpl
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-template-items'] })
      setIsCreating(false)
      toast('Invoice template created.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to create template', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; notes: string | null; items: InvoiceItem[] }) => {
      if (!userId) throw new Error('User not authenticated')
      const { error: updateError } = await supabase
        .from('invoice_templates')
        .update({ name: data.name, notes: data.notes })
        .eq('id', data.id)
        .eq('user_id', userId)
      if (updateError) throw updateError

      const oldItems = allItems?.[data.id] || []
      const itemsToDelete = oldItems.filter((oi) => !data.items.find((ni) => ni.id === oi.id))
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('invoice_template_items')
          .delete()
          .in('id', itemsToDelete.map((i) => i.id))
        if (deleteError) throw deleteError
      }

      const newItems = data.items.filter((i) => i.id.startsWith('new-'))
      if (newItems.length > 0) {
        const { error: insertError } = await supabase.from('invoice_template_items').insert(
          newItems.map((item, i) => ({
            invoice_template_id: data.id,
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
          .from('invoice_template_items')
          .update({ description: item.description, amount: item.amount })
          .eq('id', item.id)
        if (updateItemError) throw updateItemError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-template-items'] })
      setEditingId(null)
      toast('Invoice template updated.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update template', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('User not authenticated')
      const { error } = await supabase.from('invoice_templates').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-template-items'] })
      toast('Invoice template deleted.')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to delete template', 'error'),
  })

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const res = await addStarterInvoiceTemplatesAction(names)
    if (!res.ok) throw new Error(res.error)
    queryClient.invalidateQueries({ queryKey: ['invoice-templates'] })
    queryClient.invalidateQueries({ queryKey: ['invoice-template-items'] })
    return res.data.added
  }

  const reorderMutation = useMutation({
    mutationFn: async (reordered: InvoiceTemplate[]) => {
      if (!userId) throw new Error('User not authenticated')
      for (let i = 0; i < reordered.length; i++) {
        const row = reordered[i]
        if (!row) continue
        const { error } = await supabase
          .from('invoice_templates')
          .update({ position: (i + 1) * 1000 })
          .eq('id', row.id)
          .eq('user_id', userId)
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice-templates'] }),
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

  const handleSave = async (data: { name: string; notes: string | null; items: InvoiceItem[] }) => {
    if (editingId) await updateMutation.mutateAsync({ id: editingId, ...data })
    else await createMutation.mutateAsync(data)
  }

  const editing = localTemplates.find((t) => t.id === editingId)
  const editingTemplate: InvoiceTemplateWithItems | null =
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

  const existingNames = new Set(localTemplates.map((t) => t.name))

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-text">Invoice Templates</h3>
          <p className="text-sm text-text-muted mt-1">Reusable invoices — build from scratch or pull in a package or quote.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowStarters(true)} className="gap-1.5">
            <Library size={14} strokeWidth={1.5} />
            Browse starters
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={14} strokeWidth={1.5} />
            New Template
          </Button>
        </div>
      </div>

      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="New Invoice Template">
        <EditInvoiceTemplateForm
          template={{ id: 'new', name: '', description: null, notes: null, position: 0, items: [] }}
          sources={sources}
          onSave={handleSave}
          onCancel={() => setIsCreating(false)}
          isSaving={createMutation.isPending}
        />
      </Modal>

      <Modal isOpen={!!editingId} onClose={() => setEditingId(null)} title="Edit Invoice Template">
        {editingTemplate && (
          <EditInvoiceTemplateForm
            template={editingTemplate}
            sources={sources}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            isSaving={updateMutation.isPending}
          />
        )}
      </Modal>

      <StarterCatalogModal
        isOpen={showStarters}
        onClose={() => setShowStarters(false)}
        title="Browse starter invoice templates"
        blurb="Add the templates you want. Nothing is added unless you choose it."
        noun="template"
        catalog={STARTER_INVOICE_TEMPLATES}
        existingNames={existingNames}
        onAdd={handleAddStarters}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localTemplates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localTemplates.length === 0 ? (
              <Empty
                size="sm"
                className="min-h-[40vh]"
                icon={Receipt}
                title="No invoice templates yet"
                description="Save a reusable invoice, optionally from a package or quote."
                action={
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowStarters(true)}>
                      Browse starter templates
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                      New Template
                    </Button>
                  </div>
                }
              />
            ) : (
              localTemplates.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
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
