'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { Plus, Pencil, Trash2, FileSignature, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface ContractTemplate {
  id: string
  name: string
  description: string | null
  content: JSONContent
  is_default: boolean
  position: number
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function ContractTemplateManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editing, setEditing] = useState<ContractTemplate | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .order('position', { ascending: true })
      if (error) throw error
      return (data as ContractTemplate[]) || []
    },
  })

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('contract_templates')
        .insert({
          user_id: user.user.id,
          name: 'New template',
          description: null,
          content: EMPTY_DOC,
          position: (templates?.length ?? 0),
        })
        .select('*')
        .single()
      if (error) throw error
      return data as ContractTemplate
    },
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
      setEditing(tpl)
    },
    onError: () => toast('Failed to create template', 'error'),
  })

  const saveTemplate = useMutation({
    mutationFn: async (t: ContractTemplate) => {
      const { error } = await supabase
        .from('contract_templates')
        .update({
          name: t.name,
          description: t.description,
          content: t.content,
        })
        .eq('id', t.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Template saved')
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
    },
    onError: () => toast('Failed to save template', 'error'),
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contract_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Template deleted')
      setConfirmDelete(null)
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
    },
    onError: () => toast('Failed to delete template', 'error'),
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Contract templates</h3>
          <p className="text-sm text-gray-500">Pre-written agreements you can start from.</p>
        </div>
        <button
          onClick={() => createTemplate.mutate()}
          disabled={createTemplate.isPending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-black hover:bg-neutral-800 rounded-xl px-3 py-2 cursor-pointer disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={1.5} /> New template
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <FileSignature size={28} strokeWidth={1} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No templates yet. Start with one.</p>
          <button
            onClick={() => createTemplate.mutate()}
            className="text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-1.5 cursor-pointer"
          >
            + New template
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {(templates || []).map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
            >
              <FileSignature size={16} strokeWidth={1.5} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                {t.description && <p className="text-xs text-gray-500 truncate">{t.description}</p>}
              </div>
              <button
                onClick={() => setEditing(t)}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition cursor-pointer"
                title="Edit"
              >
                <Pencil size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setConfirmDelete(t.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition cursor-pointer"
                title="Delete"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing}
          saving={saveTemplate.isPending}
          onCancel={() => setEditing(null)}
          onSave={(t) => saveTemplate.mutate(t)}
        />
      )}

      {confirmDelete && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[70]" onClick={() => setConfirmDelete(null)} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Delete template?</h3>
              <p className="text-sm text-gray-500 mb-4">This can't be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteTemplate.mutate(confirmDelete)}
                  disabled={deleteTemplate.isPending}
                  className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 cursor-pointer disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TemplateEditor({
  template,
  saving,
  onCancel,
  onSave,
}: {
  template: ContractTemplate
  saving: boolean
  onCancel: () => void
  onSave: (t: ContractTemplate) => void
}) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [content, setContent] = useState<JSONContent>(template.content ?? EMPTY_DOC)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-screen sm:max-h-[92vh]">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Edit template</h3>
            <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown in the template picker"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Content</label>
              <RichTextEditor value={content} onChange={setContent} />
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button onClick={onCancel} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => onSave({ ...template, name, description: description || null, content })}
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl px-3.5 py-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Save template
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
