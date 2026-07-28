/**
 * One editable, draggable question row inside the questionnaire builder.
 *
 * Renders a type picker, the question text, and type-specific controls
 * (options editor for the choice types, a required toggle for inputs). Section
 * headings collapse to just their label. All edits flow up through `onChange`;
 * the parent owns the question list.
 *
 * @module app/(dashboard)/templates/questionnaire-question-row
 */
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { QUESTION_TYPE_META, QUESTION_TYPES, type Question } from '@/lib/questionnaires/question-schema'

interface QuestionRowProps {
  question: Question
  /** Validation problem to surface under the row (null = none / not shown). */
  issue?: string | null
  onChange: (patch: Partial<Question>) => void
  onDuplicate: () => void
  onDelete: () => void
}

const TYPE_OPTIONS = QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_META[t].label }))

export function QuestionnaireQuestionRow({ question, issue = null, onChange, onDuplicate, onDelete }: QuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const meta = QUESTION_TYPE_META[question.type]
  const isSection = question.type === 'section'

  const setOption = (i: number, value: string) => {
    const next = [...(question.options ?? [])]
    next[i] = value
    onChange({ options: next })
  }
  const addOption = () => onChange({ options: [...(question.options ?? []), ''] })
  const removeOption = (i: number) => onChange({ options: (question.options ?? []).filter((_, j) => j !== i) })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl bg-surface-muted p-3 ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Reorder question"
          className="mt-2 cursor-grab text-text-subtle hover:text-text active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              value={question.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder={isSection ? 'Section heading' : 'Question text'}
              size="sm"
              className="flex-1"
            />
            <Select
              value={question.type}
              onValueChange={(v) => onChange({ type: v as Question['type'] })}
              options={TYPE_OPTIONS}
              className="w-40 shrink-0"
            />
          </div>

          {!isSection && (
            <Input
              value={question.help_text ?? ''}
              onChange={(e) => onChange({ help_text: e.target.value })}
              placeholder="Help text (optional)"
              size="sm"
            />
          )}

          {meta.hasOptions && (
            <div className="space-y-1.5">
              {(question.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} size="sm" className="flex-1" />
                  <button type="button" aria-label="Remove option" onClick={() => removeOption(i)} className="cursor-pointer text-text-subtle hover:text-text">
                    <X size={15} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addOption} className="gap-1.5">
                <Plus size={13} strokeWidth={1.5} />
                Add option
              </Button>
            </div>
          )}

          {!isSection && (
            <Checkbox checked={question.required} onChange={(v) => onChange({ required: v })} label="Required" />
          )}

          {issue && <p className="text-xs text-red-600">{issue}</p>}
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <button type="button" aria-label="Duplicate question" onClick={onDuplicate} className="cursor-pointer text-text-subtle hover:text-text">
            <Copy size={15} strokeWidth={1.5} />
          </button>
          <button type="button" aria-label="Delete question" onClick={onDelete} className="cursor-pointer text-text-subtle hover:text-red-600">
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
