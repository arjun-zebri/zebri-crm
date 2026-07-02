/**
 * Questionnaire template builder.
 *
 * A two-pane modal: the left pane edits the name, description, and an ordered,
 * drag-sortable list of questions; the right pane shows a live preview of what
 * the couple will see. All list edits route through the pure helpers in
 * `lib/questionnaires/builder-state`, keeping this component a thin shell.
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
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { addQuestion, createQuestion, moveQuestion, removeQuestion, updateQuestion } from '@/lib/questionnaires/builder-state'
import type { Question } from '@/lib/questionnaires/question-schema'

import { QuestionnairePreview } from './questionnaire-preview'
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
  const [questions, setQuestions] = useState<Question[]>(template.questions)

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

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Edit questionnaire"
      size="fullscreen"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onCancel} variant="outline" size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ ...template, name, description: description || null, questions })}
            disabled={saving || !name.trim()}
            size="sm"
          >
            {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : null}
            Save questionnaire
          </Button>
        </div>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
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
          </div>

          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {questions.map((q) => (
                    <QuestionnaireQuestionRow key={q.id} question={q} onChange={(p) => patch(q.id, p)} onDelete={() => remove(q.id)} />
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

        {/* Preview — sticky alongside the editor on large screens. */}
        <div className="hidden rounded-2xl bg-surface-muted p-6 lg:sticky lg:top-0 lg:block lg:self-start">
          <QuestionnairePreview name={name} questions={questions} />
        </div>
      </div>
    </Modal>
  )
}
