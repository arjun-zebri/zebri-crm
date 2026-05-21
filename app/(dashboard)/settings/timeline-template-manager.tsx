'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'


import { TimePicker } from '../events/event-timeline-modal'

interface TemplateItem {
  id: string
  title: string
  start_time: string | null
  duration_min: number | null
  description: string | null
}

interface Template {
  id: string
  name: string
  position: number
  item_count?: number
}

interface TemplateWithItems extends Template {
  items: TemplateItem[]
}

// ── Starter templates ────────────────────────────────────────────────────────

const STARTER_TEMPLATES: { name: string; items: Omit<TemplateItem, 'id'>[] }[] = [
  {
    name: 'Wedding Ceremony',
    items: [
      {
        title: 'Guests arrive',
        start_time: '14:30',
        duration_min: 30,
        description: 'Pre-ceremony music, ushers seat guests, programs handed out',
      },
      {
        title: 'Processional & welcome',
        start_time: '15:00',
        duration_min: 15,
        description:
          "Wedding party processes in, then bride enters (guests rise). Celebrant welcomes guests, Acknowledgement of Country.",
      },
      {
        title: 'Readings & address',
        start_time: '15:15',
        duration_min: 15,
        description: "Chosen reading(s) by selected guests, then celebrant's personalised address about the couple",
      },
      {
        title: 'Vows & ring exchange',
        start_time: '15:30',
        duration_min: 15,
        description: 'The Monitum, asking of intent, personal vows, exchange of rings',
      },
      {
        title: 'Signing & recessional',
        start_time: '15:45',
        duration_min: 15,
        description:
          'Couple + 2 witnesses sign the register (music plays). Pronouncement, first kiss, recessional with confetti.',
      },
      {
        title: 'Family & wedding party photos',
        start_time: '16:00',
        duration_min: 30,
        description: 'Group shots - have a shot list ready. Ushers can help round people up.',
      },
      {
        title: "Couple's photos",
        start_time: '16:30',
        duration_min: null,
        description: 'Photographer takes couple away for portraits. Guests move to cocktail hour.',
      },
    ],
  },
  {
    name: 'Wedding Reception',
    items: [
      {
        title: 'Pre-reception drinks',
        start_time: '17:30',
        duration_min: 30,
        description: 'Guests arrive, canapés, background music',
      },
      {
        title: 'Guests seated',
        start_time: '18:00',
        duration_min: 15,
        description: 'Settle guests at their tables, cue music down',
      },
      {
        title: "Bridal party & couple's entrance",
        start_time: '18:15',
        duration_min: 15,
        description:
          "Announce wedding party pair by pair, build energy for the couple's grand entrance",
      },
      {
        title: 'Welcome speech',
        start_time: '18:30',
        duration_min: 10,
        description: 'Usually given by the host or father of the bride',
      },
      {
        title: 'Entrée served',
        start_time: '18:45',
        duration_min: 30,
        description: 'Pause announcements during service',
      },
      {
        title: 'Speech: Best man',
        start_time: '19:15',
        duration_min: 10,
        description: 'Confirm name pronunciation beforehand',
      },
      {
        title: 'Speech: Maid of honour',
        start_time: '19:30',
        duration_min: 10,
        description: null,
      },
      {
        title: 'Main course served',
        start_time: '19:45',
        duration_min: 45,
        description: 'Pause announcements during service',
      },
      {
        title: 'Speech: Couple',
        start_time: '20:30',
        duration_min: 10,
        description: 'Often both partners speak',
      },
      {
        title: 'Cake cutting',
        start_time: '20:45',
        duration_min: 10,
        description: 'Gather guests around the cake table for the photo',
      },
      {
        title: 'First dance & parent dances',
        start_time: '21:00',
        duration_min: 15,
        description:
          "Couple's first dance, then father–daughter / mother–son, invite all couples to join at the end",
      },
      {
        title: 'Open dancing & dessert',
        start_time: '21:15',
        duration_min: 75,
        description: 'Dessert served while the dance floor is live',
      },
      {
        title: 'Bouquet toss',
        start_time: '22:30',
        duration_min: 10,
        description: 'Gather single guests',
      },
      {
        title: 'Last song & farewell',
        start_time: '22:45',
        duration_min: 15,
        description:
          'Give guests a 15-min warning, then call them to form a send-off circle for the couple',
      },
    ],
  },
]

// ── Shared input styles ──────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

const noArrowsClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

// ── TemplateRow ──────────────────────────────────────────────────────────────

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

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
        <p className="flex-1 text-sm text-red-700">
          Delete <span className="font-medium">{template.name}</span>?
        </p>
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
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">{template.name}</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          {template.item_count || 0} item{(template.item_count || 0) !== 1 ? 's' : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(template.id)}
        className="shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
      >
        <Pencil size={15} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
      >
        <Trash2 size={15} strokeWidth={1.5} />
      </button>
    </div>
  )
}

// ── EditTemplateForm ─────────────────────────────────────────────────────────

function EditTemplateForm({
  template,
  onSave,
  onCancel,
  isSaving,
}: {
  template: TemplateWithItems
  onSave: (data: { name: string; items: TemplateItem[] }) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [name, setName] = useState(template.name)
  const [items, setItems] = useState<TemplateItem[]>(template.items)

  const addItem = () => {
    setItems([...items, { id: `new-${Date.now()}`, title: '', start_time: null, duration_min: null, description: null }])
  }

  const updateItem = (id: string, field: keyof TemplateItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), items })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Template Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Standard Reception"
          className={inputClass}
          disabled={isSaving}
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Timeline Items</label>
        <div className="space-y-2">
          {items.length > 0 && (
            <div className="grid grid-cols-[140px_1fr_72px_32px] gap-x-2 mb-1 px-0.5">
              <span className="text-xs text-gray-400">Time</span>
              <span className="text-xs text-gray-400">Title</span>
              <span className="text-xs text-gray-400 text-right">Dur (min)</span>
              <span />
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[140px_1fr_72px_32px] gap-x-2 items-center">
              <TimePicker
                value={item.start_time ?? ''}
                onChange={(v) => updateItem(item.id, 'start_time', v || null)}
              />
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                placeholder="e.g., Bridal entrance"
                className={inputClass}
                disabled={isSaving}
              />
              <div className="flex items-center border border-gray-200 rounded-xl px-2.5 py-2 bg-white">
                <input
                  type="number"
                  value={item.duration_min ?? ''}
                  onChange={(e) =>
                    updateItem(item.id, 'duration_min', e.target.value ? parseInt(e.target.value) : null)
                  }
                  placeholder=" - "
                  min={1}
                  className={`w-full text-sm text-gray-900 bg-transparent focus:outline-none ${noArrowsClass}`}
                  disabled={isSaving}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex items-center justify-center cursor-pointer"
                disabled={isSaving}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            disabled={isSaving}
            className="text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 py-1"
          >
            <Plus size={14} strokeWidth={1.5} />
            Add item
          </button>
        </div>
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

// ── TimelineTemplateManager ──────────────────────────────────────────────────

export function TimelineTemplateManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['timeline-templates'],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_templates')
        .select('id, name, position')
        .eq('user_id', userId!)
        .order('position', { ascending: true })
      if (error) throw error
      return data as Template[]
    },
  })

  const { data: allItems } = useQuery({
    queryKey: ['timeline-template-items'],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_template_items')
        .select('id, template_id, title, start_time, duration_min, description, position')
        .eq('user_id', userId!)
        .order('position', { ascending: true })
      if (error) throw error
      const grouped: Record<string, TemplateItem[]> = {}
      ;(data || []).forEach((item: any) => {
        if (!grouped[item.template_id]) grouped[item.template_id] = []
        grouped[item.template_id].push({
          id: item.id,
          title: item.title,
          start_time: item.start_time,
          duration_min: item.duration_min,
          description: item.description,
        })
      })
      return grouped
    },
  })

  const templatesWithCounts = templates.map((t) => ({
    ...t,
    item_count: allItems?.[t.id]?.length ?? 0,
  }))

  const saveTemplates = async (userId: string, templatesToSave: typeof STARTER_TEMPLATES, basePosition = 0) => {
    for (let ti = 0; ti < templatesToSave.length; ti++) {
      const tmpl = templatesToSave[ti]
      const { data, error } = await supabase
        .from('timeline_templates')
        .insert({ user_id: userId, name: tmpl.name, position: (basePosition + ti) * 1000 })
        .select('id')
        .single()
      if (error) throw error

      if (tmpl.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('timeline_template_items')
          .insert(
            tmpl.items.map((item, i) => ({
              template_id: data.id,
              user_id: userId,
              title: item.title,
              start_time: item.start_time,
              duration_min: item.duration_min,
              description: item.description,
              position: (i + 1) * 1000,
            }))
          )
        if (itemsErr) throw itemsErr
      }
    }
  }

  const loadStartersMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not authenticated')
      return saveTemplates(userId, STARTER_TEMPLATES, templates.length)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-templates'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-template-items'] })
      toast('Starter templates loaded.')
    },
    onError: (err: any) => toast(err.message || 'Failed to load templates', 'error'),
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; items: TemplateItem[] }) => {
      if (!userId) throw new Error('Not authenticated')
      const { data: tmpl, error } = await supabase
        .from('timeline_templates')
        .insert({ user_id: userId, name: data.name, position: templates.length * 1000 })
        .select('id')
        .single()
      if (error) throw error

      if (data.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('timeline_template_items')
          .insert(
            data.items.map((item, i) => ({
              template_id: tmpl.id,
              user_id: userId,
              title: item.title,
              start_time: item.start_time,
              duration_min: item.duration_min,
              description: item.description,
              position: (i + 1) * 1000,
            }))
          )
        if (itemsErr) throw itemsErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-templates'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-template-items'] })
      setIsCreating(false)
      toast('Template created.')
    },
    onError: (err: any) => toast(err.message || 'Failed to create template', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; items: TemplateItem[] }) => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('timeline_templates')
        .update({ name: data.name })
        .eq('id', data.id)
        .eq('user_id', userId)
      if (error) throw error

      const oldItems = allItems?.[data.id] || []
      const toDelete = oldItems.filter((oi) => !data.items.find((ni) => ni.id === oi.id))
      if (toDelete.length > 0) {
        await supabase.from('timeline_template_items').delete().in('id', toDelete.map((i) => i.id))
      }

      const newItems = data.items.filter((i) => i.id.startsWith('new-'))
      if (newItems.length > 0) {
        const { error: insertErr } = await supabase.from('timeline_template_items').insert(
          newItems.map((item, i) => ({
            template_id: data.id,
            user_id: userId,
            title: item.title,
            start_time: item.start_time,
            duration_min: item.duration_min,
            description: item.description,
            position: (oldItems.length + i + 1) * 1000,
          }))
        )
        if (insertErr) throw insertErr
      }

      for (const item of data.items.filter((i) => !i.id.startsWith('new-'))) {
        await supabase
          .from('timeline_template_items')
          .update({ title: item.title, start_time: item.start_time, duration_min: item.duration_min, description: item.description })
          .eq('id', item.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-templates'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-template-items'] })
      setEditingId(null)
      toast('Template updated.')
    },
    onError: (err: any) => toast(err.message || 'Failed to update template', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('timeline_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-templates'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-template-items'] })
      toast('Template deleted.')
    },
    onError: (err: any) => toast(err.message || 'Failed to delete template', 'error'),
  })

  const handleSave = async (data: { name: string; items: TemplateItem[] }) => {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const editingTemplate = editingId
    ? { ...templates.find((t) => t.id === editingId)!, items: allItems?.[editingId] || [] }
    : null

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Timeline Templates</h3>
          <p className="text-sm text-gray-500 mt-1">
            Reusable sets of timeline items - with times - you can apply to any event.
          </p>
        </div>
        <button
          onClick={() => { setEditingId(null); setIsCreating(true) }}
          className="shrink-0 px-3 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={15} strokeWidth={1.5} />
          New Template
        </button>
      </div>

      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="New Timeline Template">
        <EditTemplateForm
          template={{ id: 'new', name: '', position: 0, items: [] }}
          onSave={handleSave}
          onCancel={() => setIsCreating(false)}
          isSaving={createMutation.isPending}
        />
      </Modal>

      <Modal isOpen={!!editingId} onClose={() => setEditingId(null)} title="Edit Timeline Template">
        {editingTemplate && (
          <EditTemplateForm
            template={editingTemplate as TemplateWithItems}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            isSaving={updateMutation.isPending}
          />
        )}
      </Modal>

      {templatesWithCounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-200 rounded-xl gap-4">
          <div>
            <p className="text-sm text-gray-500">No templates yet</p>
            <p className="text-xs text-gray-400 mt-1">Build a template once, apply it to any event</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={() => loadStartersMutation.mutate()}
              disabled={loadStartersMutation.isPending}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} strokeWidth={1.5} />
              {loadStartersMutation.isPending ? 'Loading…' : 'Load starter templates'}
            </button>
            <button
              onClick={() => { setEditingId(null); setIsCreating(true) }}
              className="px-3 py-2 text-sm rounded-xl bg-black text-white hover:bg-neutral-800 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} strokeWidth={1.5} />
              New Template
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {templatesWithCounts.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onEdit={(id) => { setIsCreating(false); setEditingId(id) }}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
