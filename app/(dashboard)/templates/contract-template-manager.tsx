'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { Plus, FileSignature, Loader2, Library } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useToast } from '@/components/ui/toast'
import { STARTER_CONTRACTS } from '@/lib/contracts/starter-contracts'
import { createClient } from '@/lib/supabase/client'

import { ContractTemplatePreview } from './contract-template-preview'
import { addStarterContractsAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'
import { TemplatePreviewHeader } from './template-preview-header'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesTwoPane } from './templates-two-pane'

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
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const isSearching = search.trim().length > 0
  const visible = isSearching
    ? (templates ?? []).filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : templates ?? []

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

  const all = templates ?? []
  const effectiveId = selectedId && all.some((t) => t.id === selectedId) ? selectedId : (all[0]?.id ?? null)
  const selectedC = all.find((t) => t.id === effectiveId) ?? null

  return (
    <div className="flex h-full flex-col">
      <TemplatesActions>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contract templates…"
          className="w-36 sm:w-48"
        />
        <Button
          variant="outline"
          onClick={() => setShowStarters(true)}
          disabled={createTemplate.isPending}
          className="gap-1.5"
        >
          <Library size={14} strokeWidth={1.5} />
          Browse starters
        </Button>
        <Button
          onClick={() => createTemplate.mutate()}
          disabled={createTemplate.isPending}
          className="gap-1.5"
        >
          <Plus size={14} strokeWidth={1.5} />
          New template
        </Button>
      </TemplatesActions>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-surface-muted rounded-control animate-pulse" />
          ))}
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <div className="flex flex-1 items-center justify-center pb-[10vh]">
          <Empty
            size="sm"
            icon={FileSignature}
            title="No contract templates yet"
            description="Create one from scratch or add from the starter library."
          />
        </div>
      ) : (
        <TemplatesTwoPane
          selected={!!selectedId}
          onBack={() => setSelectedId(null)}
          list={
            visible.length === 0 ? (
              <p className="py-8 text-center text-body text-text-subtle">No matches.</p>
            ) : (
              <div className="space-y-0.5">
                {visible.map((t) => {
                  const active = t.id === effectiveId
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left transition ${
                        active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                      }`}
                    >
                      <FileSignature size={16} strokeWidth={1.5} className="shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-text">{t.name}</span>
                        {t.description && <span className="block truncate text-body text-text-subtle">{t.description}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          }
          detail={
            selectedC ? (
              <div className="space-y-4">
                <TemplatePreviewHeader
                  title={selectedC.name}
                  editLabel="Edit template"
                  onEdit={() => setEditing(selectedC)}
                  onDelete={() => setConfirmDelete(selectedC.id)}
                />
                <ContractTemplatePreview content={selectedC.content} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center pb-[10vh]">
                <p className="text-body text-text-subtle">Select a template to preview.</p>
              </div>
            )
          }
        />
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
            <p className="text-body text-text-muted">This can't be undone.</p>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setConfirmDelete(null)} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={() => deleteTemplate.mutate(confirmDelete)}
                disabled={deleteTemplate.isPending}
                variant="danger"
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
          <label className="block text-body font-medium text-text mb-2">Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-body font-medium text-text mb-2">Description (optional)</label>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description shown in the template picker"
          />
        </div>
        <div>
          <label className="block text-body font-medium text-text mb-2">Content</label>
          <RichTextEditor value={content} onChange={setContent} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ ...template, name, description: description || null, content })}
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
            Save template
          </Button>
        </div>
      </div>
    </Modal>
  )
}
