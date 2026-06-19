'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { Plus, Pencil, Trash2, FileSignature, Loader2, Library } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { STARTER_CONTRACTS } from '@/lib/contracts/starter-contracts'
import { createClient } from '@/lib/supabase/client'

import { addStarterContractsAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'

interface ContractTemplate {
  id: string
  name: string
  description: string | null
  content: JSONContent
  is_default: boolean
  position: number
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/**
 * Manages the display and editing of contract templates.
 */
export function ContractTemplateManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editing, setEditing] = useState<ContractTemplate | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showStarters, setShowStarters] = useState(false)

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

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const res = await addStarterContractsAction(names)
    if (!res.ok) throw new Error(res.error)
    queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
    return res.data.added
  }

  const existingNames = new Set((templates || []).map((t) => t.name))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-text">Contract templates</h3>
          <p className="text-sm text-text-muted">Pre-written agreements you can start from.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowStarters(true)}
            disabled={createTemplate.isPending}
            className="gap-1.5"
          >
            <Library size={14} strokeWidth={1.5} />
            Browse starters
          </Button>
          <Button
            size="sm"
            onClick={() => createTemplate.mutate()}
            disabled={createTemplate.isPending}
            className="gap-1.5"
          >
            <Plus size={14} strokeWidth={1.5} />
            New template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-surface-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <Empty
          size="sm"
          className="min-h-[40vh]"
          icon={FileSignature}
          title="No contract templates yet"
          description="Create one from scratch or add from the starter library."
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowStarters(true)}>
                Browse starters
              </Button>
              <Button size="sm" onClick={() => createTemplate.mutate()}>
                New template
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {(templates || []).map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-muted"
            >
              <FileSignature size={16} strokeWidth={1.5} className="text-text-muted shrink-0" />
              <button type="button" onClick={() => setEditing(t)} className="min-w-0 flex-1 cursor-pointer text-left">
                <p className="text-sm font-medium text-text truncate">{t.name}</p>
                {t.description && <p className="text-xs text-text-subtle truncate">{t.description}</p>}
              </button>
              <RowActionsMenu
                alwaysVisible
                actions={[
                  { label: 'Edit', icon: <Pencil size={15} strokeWidth={1.5} />, onSelect: () => setEditing(t) },
                  {
                    label: 'Delete',
                    destructive: true,
                    icon: <Trash2 size={15} strokeWidth={1.5} />,
                    onSelect: () => setConfirmDelete(t.id),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <StarterCatalogModal
        isOpen={showStarters}
        onClose={() => setShowStarters(false)}
        title="Browse starter contract templates"
        blurb="Add the templates you want. Nothing is added unless you choose it."
        noun="template"
        catalog={STARTER_CONTRACTS.map((c) => ({ name: c.name, subtitle: c.description }))}
        existingNames={existingNames}
        onAdd={handleAddStarters}
      />

      {editing && (
        <TemplateEditor
          template={editing}
          saving={saveTemplate.isPending}
          onCancel={() => setEditing(null)}
          onSave={(t) => saveTemplate.mutate(t)}
        />
      )}

      {confirmDelete && (
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete template?">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">This can't be undone.</p>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setConfirmDelete(null)} variant="outline" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => deleteTemplate.mutate(confirmDelete)}
                disabled={deleteTemplate.isPending}
                variant="danger"
                size="sm"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface TemplateEditorProps {
  template: ContractTemplate
  saving: boolean
  onCancel: () => void
  onSave: (t: ContractTemplate) => void
}

function TemplateEditor({ template, saving, onCancel, onSave }: TemplateEditorProps) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [content, setContent] = useState<JSONContent>(template.content ?? EMPTY_DOC)

  return (
    <Modal isOpen={true} onClose={onCancel} title="Edit contract template" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-2">Description (optional)</label>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description shown in the template picker"
            size="sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-2">Content</label>
          <RichTextEditor value={content} onChange={setContent} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button onClick={onCancel} variant="outline" size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ ...template, name, description: description || null, content })}
            disabled={saving || !name.trim()}
            size="sm"
          >
            {saving ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
            Save template
          </Button>
        </div>
      </div>
    </Modal>
  )
}
