'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react'
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

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

const noArrowsClass = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
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
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  if (confirmDelete) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50"
      >
        <p className="flex-1 text-sm text-red-700">Delete <span className="font-medium">{template.name}</span>?</p>
        <button
          type="button"
          onClick={() => { onDelete(template.id); setConfirmDelete(false) }}
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
        isDragging
          ? 'border-gray-300 bg-gray-50 shadow-lg'
          : 'border-gray-200 hover:bg-gray-50'
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
        <h4 className="text-sm font-medium text-gray-900 truncate">{template.name}</h4>
        {template.notes && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{template.notes}</p>
        )}
      </div>

      <div className="text-right shrink-0">
        {(template.total ?? 0) > 0 ? (
          <p className="text-sm font-medium text-gray-900">{formatCurrency(template.total ?? 0)}</p>
        ) : null}
        <p className="text-xs text-gray-400">
          {template.item_count || 0} item{(template.item_count || 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onEdit(template.id)}
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

function EditTemplateForm({
  template,
  onSave,
  onCancel,
  isSaving,
}: {
  template: TemplateWithItems
  onSave: (data: { name: string; notes: string | null; items: TemplateItem[] }) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [name, setName] = useState(template.name)
  const [notes, setNotes] = useState(template.notes || '')
  const [items, setItems] = useState<TemplateItem[]>(template.items)

  const total = items.reduce((sum, item) => sum + (parseFloat(item.amount as any) || 0), 0)

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
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Template Name <span className="text-red-500">*</span>
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
          placeholder="Short description shown on the template list"
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

export function QuoteTemplateManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [localTemplates, setLocalTemplates] = useState<Template[]>([])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

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
      data.forEach((item: any) => {
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
    if (templates) {
      setLocalTemplates(
        templates.map((t) => {
          const items = allItems?.[t.id] || []
          return {
            ...t,
            item_count: items.length,
            total: items.reduce((sum, item) => sum + (item.amount || 0), 0),
          }
        })
      )
    }
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
    onError: (err: any) => {
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
    onError: (err: any) => {
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
    onError: (err: any) => {
      toast(err.message || 'Failed to delete template', 'error')
    },
  })

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
          <div key={i} className="h-12 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Quote Templates</h3>
          <p className="text-sm text-gray-500 mt-1">
            Reusable line item sets for faster quote generation.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 px-3 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={15} strokeWidth={1.5} />
          New Template
        </button>
      </div>

      {/* Create modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="New Template"
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

      {/* Edit modal */}
      <Modal
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
        title="Edit Template"
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
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-500">No templates yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Save line items as a reusable template</p>
                <button
                  onClick={openCreate}
                  className="px-3 py-2 text-sm rounded-xl bg-black text-white hover:bg-neutral-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  New Template
                </button>
              </div>
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
