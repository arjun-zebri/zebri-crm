'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical, Pencil, FileText, Library } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { STARTER_QUOTE_TEMPLATES } from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/client'

import { LineItemPreview } from './line-item-preview'
import { addStarterQuoteTemplatesAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'

interface TemplateItem {
  id: string
  description: string
  amount: number
}

interface Template {
  id: string
  name: string
  description: string | null
  notes: string | null
  position: number
  item_count?: number
  total?: number
}

interface TemplateWithItems extends Template {
  items: TemplateItem[]
}

const noArrowsClass = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: Template
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id })

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

interface EditTemplateFormProps {
  template: TemplateWithItems
  onSave: (data: { name: string; notes: string | null; items: TemplateItem[] }) => void
  onCancel: () => void
  isSaving: boolean
}

function EditTemplateForm({ template, onSave, onCancel, isSaving }: EditTemplateFormProps) {
  const [name, setName] = useState(template.name)
  const [notes, setNotes] = useState(template.notes || '')
  const [items, setItems] = useState<TemplateItem[]>(template.items)

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const addItem = () => {
    const newId = `new-${Date.now()}`
    setItems([...items, { id: newId, description: '', amount: 0 }])
  }

  const updateItem = (id: string, field: 'description' | 'amount', value: string | number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value }
          : item
      )
    )
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      items,
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Template Name <span className="text-danger">*</span>
          </label>
          <Input
            type="text"
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
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short description shown on the template list"
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
 * Manages the display and editing of quote templates.
 */
export function QuoteTemplateManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showStarters, setShowStarters] = useState(false)
  const [localTemplates, setLocalTemplates] = useState<Template[]>([])

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    void getUser()
  }, [supabase.auth])

  const { data: templates, isLoading } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
      if (error) throw error
      return (data || []) as Template[]
    },
    enabled: !!userId,
  })

  const { data: allItems } = useQuery({
    queryKey: ['quote-template-items'],
    queryFn: async () => {
      if (!userId) return {}
      const { data, error } = await supabase
        .from('quote_template_items')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
      if (error) throw error
      const grouped: Record<string, TemplateItem[]> = {}
      ;(data ?? []).forEach((item) => {
        if (!grouped[item.template_id]) grouped[item.template_id] = []
        grouped[item.template_id].push({
          id: item.id,
          description: item.description,
          amount: item.amount,
        })
      })
      return grouped
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (!templates) return
    const updatedTemplates = templates.map((t) => {
      const items = allItems?.[t.id] || []
      return {
        ...t,
        item_count: items.length,
        total: items.reduce((sum, item) => sum + (item.amount || 0), 0),
      }
    })
    // Run on data changes to sync local display state with React Query data.
    // This is a standard pattern; any optimization will be micro.
    // @typescript-eslint/no-explicit-any We know this is safe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalTemplates(updatedTemplates)
  }, [templates, allItems])

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; notes: string | null; items: TemplateItem[] }) => {
      if (!userId) throw new Error('User not authenticated')

      const { data: template, error: insertError } = await supabase
        .from('quote_templates')
        .insert({
          user_id: userId,
          name: data.name,
          notes: data.notes,
          position: (templates?.length ?? 0) * 1000,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      if (data.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_template_items')
          .insert(
            data.items.map((item, i) => ({
              template_id: template.id,
              user_id: userId,
              description: item.description,
              amount: item.amount,
              position: (i + 1) * 1000,
            }))
          )

        if (itemsError) throw itemsError
      }

      return template
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] })
      queryClient.invalidateQueries({ queryKey: ['quote-template-items'] })
      setIsCreating(false)
      toast('Template created.')
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to create template', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; notes: string | null; items: TemplateItem[] }) => {
      if (!userId) throw new Error('User not authenticated')

      const { error: updateError } = await supabase
        .from('quote_templates')
        .update({ name: data.name, notes: data.notes })
        .eq('id', data.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      const oldItems = allItems?.[data.id] || []
      const itemsToDelete = oldItems.filter((oi) => !data.items.find((ni) => ni.id === oi.id))

      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('quote_template_items')
          .delete()
          .in(
            'id',
            itemsToDelete.map((i) => i.id)
          )

        if (deleteError) throw deleteError
      }

      const newItems = data.items.filter((i) => i.id.startsWith('new-'))
      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from('quote_template_items')
          .insert(
            newItems.map((item, i) => ({
              template_id: data.id,
              user_id: userId,
              description: item.description,
              amount: item.amount,
              position: (oldItems.length + i + 1) * 1000,
            }))
          )

        if (insertError) throw insertError
      }

      const updatedItems = data.items.filter((i) => !i.id.startsWith('new-'))
      for (const item of updatedItems) {
        const { error: updateItemError } = await supabase
          .from('quote_template_items')
          .update({ description: item.description, amount: item.amount })
          .eq('id', item.id)

        if (updateItemError) throw updateItemError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] })
      queryClient.invalidateQueries({ queryKey: ['quote-template-items'] })
      setEditingId(null)
      toast('Template updated.')
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to update template', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('User not authenticated')
      const { error } = await supabase
        .from('quote_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] })
      queryClient.invalidateQueries({ queryKey: ['quote-template-items'] })
      toast('Template deleted.')
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to delete template', 'error')
    },
  })

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const res = await addStarterQuoteTemplatesAction(names)
    if (!res.ok) throw new Error(res.error)
    queryClient.invalidateQueries({ queryKey: ['quote-templates'] })
    queryClient.invalidateQueries({ queryKey: ['quote-template-items'] })
    return res.data.added
  }

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Template[]) => {
      if (!userId) throw new Error('User not authenticated')
      for (let i = 0; i < reordered.length; i++) {
        const { error } = await supabase
          .from('quote_templates')
          .update({ position: (i + 1) * 1000 })
          .eq('id', reordered[i].id)
          .eq('user_id', userId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] })
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localTemplates.findIndex((t) => t.id === active.id)
    const newIndex = localTemplates.findIndex((t) => t.id === over.id)

    const reordered = arrayMove(localTemplates, oldIndex, newIndex)
    setLocalTemplates(reordered)
    await reorderMutation.mutateAsync(reordered)
  }

  const handleSaveTemplate = async (data: { name: string; notes: string | null; items: TemplateItem[] }) => {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const editingTemplate = editingId
    ? {
        ...localTemplates.find((t) => t.id === editingId),
        items: allItems?.[editingId] || [],
      }
    : null

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
          <h3 className="text-xl font-semibold text-text">Quote Templates</h3>
          <p className="text-sm text-text-muted mt-1">
            Reusable line item sets for faster quote generation.
          </p>
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

      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="New Quote Template"
      >
        <EditTemplateForm
          template={{
            id: 'new',
            name: '',
            description: null,
            notes: null,
            position: 0,
            items: [],
          }}
          onSave={handleSaveTemplate}
          onCancel={() => setIsCreating(false)}
          isSaving={createMutation.isPending}
        />
      </Modal>

      <Modal
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
        title="Edit Quote Template"
      >
        {editingTemplate && (
          <EditTemplateForm
            template={editingTemplate as TemplateWithItems}
            onSave={handleSaveTemplate}
            onCancel={() => setEditingId(null)}
            isSaving={updateMutation.isPending}
          />
        )}
      </Modal>

      <StarterCatalogModal
        isOpen={showStarters}
        onClose={() => setShowStarters(false)}
        title="Browse starter quote templates"
        blurb="Add the templates you want. Nothing is added unless you choose it."
        noun="template"
        catalog={STARTER_QUOTE_TEMPLATES}
        existingNames={existingNames}
        onAdd={handleAddStarters}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localTemplates.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {localTemplates.length === 0 ? (
              <Empty
                size="sm"
                className="min-h-[40vh]"
                icon={FileText}
                title="No quote templates yet"
                description="Save line items as a reusable template."
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
                  onEdit={(id) => { setIsCreating(false); setEditingId(id) }}
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
