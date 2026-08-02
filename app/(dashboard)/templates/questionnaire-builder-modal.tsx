/**
 * Questionnaire template builder.
 *
 * A two-pane modal: the left pane edits the name, description, display style
 * (one question at a time vs all on one page), and an ordered, drag-sortable
 * list of questions; the right pane shows the real branded couple experience
 * via {@link QuestionnaireExperiencePreview}. All list edits route through
 * the pure helpers in `lib/questionnaires/builder-state`, keeping this
 * component a thin shell; the same helpers validate before save.
 *
 * @module app/(dashboard)/templates/questionnaire-builder-modal
 */
'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { QuestionnaireExperiencePreview } from '@/components/questionnaires/experience-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  addQuestion,
  createQuestion,
  duplicateQuestion,
  moveQuestion,
  questionIssues,
  removeQuestion,
  updateQuestion,
} from '@/lib/questionnaires/builder-state'
import { DISPLAY_MODES, toDisplayMode, type Question, type QuestionnaireDisplayMode } from '@/lib/questionnaires/question-schema'

import { QuestionnaireQuestionRow } from './questionnaire-question-row'
import type { QuestionnaireTemplateRow } from './questionnaire-template-manager'

interface BuilderProps {
  template: QuestionnaireTemplateRow
  saving: boolean
  onCancel: () => void
  onSave: (t: QuestionnaireTemplateRow) => void
}

export function QuestionnaireBuilderModal({ template, saving, onCancel, onSave }: BuilderProps) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [displayMode, setDisplayMode] = useState<QuestionnaireDisplayMode>(toDisplayMode(template.display_mode))
  const [questions, setQuestions] = useState<Question[]>(template.questions)
  // Validation stays quiet while building; it surfaces on a save attempt.
  const [showIssues, setShowIssues] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      setQuestions((qs) => moveQuestion(qs, String(active.id), String(over.id)))
    }
  }

  const handleAdd = () => setQuestions((qs) => addQuestion(qs, createQuestion('short_text', crypto.randomUUID())))
  const patch = (id: string, p: Partial<Question>) => setQuestions((qs) => updateQuestion(qs, id, p))
  const remove = (id: string) => setQuestions((qs) => removeQuestion(qs, id))
  const duplicate = (id: string) => setQuestions((qs) => duplicateQuestion(qs, id, crypto.randomUUID()))

  const issues = useMemo(() => questionIssues(questions), [questions])
  const issueByQuestion = useMemo(() => new Map(issues.map((i) => [i.questionId, i.message])), [issues])

  const handleSave = () => {
    if (issues.length > 0) {
      setShowIssues(true)
      return
    }
    onSave({ ...template, name, description: description || null, display_mode: displayMode, questions })
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Edit questionnaire"
      size="fullscreen"
      footer={
        <div className="flex items-center justify-end gap-3">
          {showIssues && issues.length > 0 && (
            <p className="text-sm text-red-600">Fix the highlighted question{issues.length === 1 ? '' : 's'} to save.</p>
          )}
          <Button onClick={onCancel} variant="outline" size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm">
            {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : null}
            Save questionnaire
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 lg:min-h-full lg:flex-row lg:items-stretch">
        {/* Editor */}
        <div className="space-y-4 lg:flex-1 lg:min-w-0">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} size="sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Description (optional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown in the template picker"
                size="sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Couples answer</label>
              <div className="inline-flex overflow-hidden rounded-control border border-border bg-surface">
                {DISPLAY_MODES.map((m, i) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setDisplayMode(m.value)}
                    className={`cursor-pointer px-2.5 py-1 text-xs font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''} ${
                      displayMode === m.value ? 'bg-surface-muted text-text' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {questions.map((q) => (
                    <QuestionnaireQuestionRow
                      key={q.id}
                      question={q}
                      issue={showIssues ? (issueByQuestion.get(q.id) ?? null) : null}
                      onChange={(p) => patch(q.id, p)}
                      onDuplicate={() => duplicate(q.id)}
                      onDelete={() => remove(q.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="w-full gap-1.5">
              <Plus size={14} strokeWidth={1.5} />
              Add question
            </Button>
          </div>
        </div>

        {/* Preview — the real branded couple experience. On large screens it
            fills the column so the panel reaches the bottom of the modal
            (flex-1 + min-h-0 lets the inner preview scroll rather than the
            panel growing past the modal). */}
        <div className="hidden rounded-2xl bg-surface-muted p-4 lg:flex lg:flex-1 lg:min-w-0 lg:flex-col">
          <p className="mb-3 px-2 text-xs uppercase tracking-wider text-text-subtle">Preview: what the couple sees</p>
          <div className="min-h-0 lg:flex-1">
            <QuestionnaireExperiencePreview title={name} questions={questions} displayMode={displayMode} heightClass="h-full min-h-[600px]" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
