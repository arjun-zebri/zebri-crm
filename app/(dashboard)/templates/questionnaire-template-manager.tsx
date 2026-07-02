/**
 * Manages the display and editing of questionnaire templates.
 *
 * Mirrors {@link ContractTemplateManager}: an RLS-scoped list of the MC's
 * templates with create / edit / delete and a starter catalog. Editing opens
 * the full {@link QuestionnaireBuilderModal} (question list + live preview)
 * rather than a single rich-text field.
 *
 * @module app/(dashboard)/templates/questionnaire-template-manager
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardList, Library } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import type { Question } from '@/lib/questionnaires/question-schema'
import { STARTER_QUESTIONNAIRES } from '@/lib/questionnaires/starter-questionnaires'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

import { QuestionnaireBuilderModal } from './questionnaire-builder-modal'
import { QuestionnairePreview } from './questionnaire-preview'
import { addStarterQuestionnairesAction } from './starter-actions'
import { StarterCatalogModal } from './starter-catalog-modal'
import { TemplatePreviewHeader } from './template-preview-header'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesTwoPane } from './templates-two-pane'

/** A questionnaire template row with its questions parsed from JSON. */
export interface QuestionnaireTemplateRow {
  id: string
  name: string
  description: string | null
  questions: Question[]
  is_starter: boolean
  position: number
}

type DbRow = Database['public']['Tables']['questionnaire_templates']['Row']

/** Parses the stored JSON questions into typed objects. */
function toRow(r: DbRow): QuestionnaireTemplateRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    questions: Array.isArray(r.questions) ? (r.questions as unknown as Question[]) : [],
    is_starter: r.is_starter,
    position: r.position,
  }
}

export function QuestionnaireTemplateManager() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editing, setEditing] = useState<QuestionnaireTemplateRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showStarters, setShowStarters] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['questionnaire-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaire_templates')
        .select('*')
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []).map(toRow)
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
        .from('questionnaire_templates')
        .insert({ user_id: user.user.id, name: 'New questionnaire', questions: [], position: templates?.length ?? 0 })
        .select('*')
        .single()
      if (error) throw error
      return toRow(data)
    },
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] })
      setEditing(tpl)
    },
    onError: () => toast('Failed to create questionnaire', 'error'),
  })

  const saveTemplate = useMutation({
    mutationFn: async (t: QuestionnaireTemplateRow) => {
      const { error } = await supabase
        .from('questionnaire_templates')
        .update({
          name: t.name,
          description: t.description,
          questions: t.questions as unknown as DbRow['questions'],
        })
        .eq('id', t.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Questionnaire saved')
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] })
    },
    onError: () => toast('Failed to save questionnaire', 'error'),
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questionnaire_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Questionnaire deleted')
      setConfirmDelete(null)
      queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] })
    },
    onError: () => toast('Failed to delete questionnaire', 'error'),
  })

  const handleAddStarters = async (names: string[]): Promise<number> => {
    const res = await addStarterQuestionnairesAction(names)
    if (!res.ok) throw new Error(res.error)
    queryClient.invalidateQueries({ queryKey: ['questionnaire-templates'] })
    return res.data.added
  }

  const existingNames = new Set((templates ?? []).map((t) => t.name))

  const list = templates ?? []
  const effectiveId =
    selectedId && list.some((t) => t.id === selectedId) ? selectedId : (list[0]?.id ?? null)
  const selectedQ = list.find((t) => t.id === effectiveId) ?? null

  return (
    <div className="flex h-full flex-col">
      <TemplatesActions>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questionnaires…"
          size="sm"
          className="w-36 sm:w-48"
        />
        <Button size="sm" variant="outline" onClick={() => setShowStarters(true)} className="gap-1.5">
          <Library size={14} strokeWidth={1.5} />
          Browse starters
        </Button>
        <Button size="sm" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending} className="gap-1.5">
          <Plus size={14} strokeWidth={1.5} />
          New questionnaire
        </Button>
      </TemplatesActions>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <div className="flex flex-1 items-center justify-center pb-[10vh]">
          <Empty
            size="sm"
            icon={ClipboardList}
            title="No questionnaires yet"
            description="Create one from scratch or add from the starter library."
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
              <div className="space-y-0.5">
                {visible.map((t) => {
                  const active = t.id === effectiveId
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                        active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                      }`}
                    >
                      <ClipboardList size={16} strokeWidth={1.5} className="shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">{t.name}</span>
                        <span className="block truncate text-xs text-text-subtle">
                          {t.description || `${t.questions.length} question${t.questions.length === 1 ? '' : 's'}`}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          }
          detail={
            selectedQ ? (
              <div className="space-y-4">
                <TemplatePreviewHeader
                  title={selectedQ.name}
                  editLabel="Edit questionnaire"
                  onEdit={() => setEditing(selectedQ)}
                  onDelete={() => setConfirmDelete(selectedQ.id)}
                />
                <QuestionnairePreview name={selectedQ.name} questions={selectedQ.questions} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center pb-[10vh]">
                <p className="text-sm text-text-subtle">Select a questionnaire to preview.</p>
              </div>
            )
          }
        />
      )}

      <StarterCatalogModal
        isOpen={showStarters}
        onClose={() => setShowStarters(false)}
        title="Browse starter questionnaires"
        blurb="Add the ones you want. Nothing is added unless you choose it."
        noun="questionnaire"
        catalog={STARTER_QUESTIONNAIRES.map((q) => ({ name: q.name, subtitle: q.description }))}
        existingNames={existingNames}
        onAdd={handleAddStarters}
      />

      {editing && (
        <QuestionnaireBuilderModal
          template={editing}
          saving={saveTemplate.isPending}
          onCancel={() => setEditing(null)}
          onSave={(t) => saveTemplate.mutate(t)}
        />
      )}

      {confirmDelete && (
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete questionnaire?">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">This can&apos;t be undone.</p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setConfirmDelete(null)} variant="outline" size="sm">
                Cancel
              </Button>
              <Button onClick={() => deleteTemplate.mutate(confirmDelete)} disabled={deleteTemplate.isPending} variant="danger" size="sm">
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
