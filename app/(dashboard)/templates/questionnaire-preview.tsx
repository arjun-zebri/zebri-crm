/**
 * Non-interactive preview of a questionnaire as the couple will see it.
 *
 * Renders every question stacked in a calm card so the MC can read the whole
 * flow while building. The couple-facing page (`/questionnaire/[token]`) is the
 * interactive, one-question-at-a-time version; this mirrors its look without
 * the wizard behaviour.
 *
 * @module app/(dashboard)/templates/questionnaire-preview
 */
'use client'

import { QUESTION_TYPE_META, type Question } from '@/lib/questionnaires/question-schema'

interface PreviewProps {
  name: string
  questions: Question[]
}

/** A faux field box used to suggest an input without being interactive. */
function FieldBox({ tall }: { tall?: boolean }) {
  return <div className={`rounded-xl border border-border bg-surface ${tall ? 'h-20' : 'h-10'}`} />
}

function QuestionPreview({ question }: { question: Question }) {
  if (question.type === 'section') {
    return <h4 className="pt-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{question.label || 'Section'}</h4>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text">
        {question.label || 'Untitled question'}
        {question.required && <span className="ml-1 text-red-500">*</span>}
      </p>
      {question.help_text && <p className="text-xs text-text-subtle">{question.help_text}</p>}
      {renderControl(question)}
    </div>
  )
}

function renderControl(question: Question) {
  switch (question.type) {
    case 'long_text':
      return <FieldBox tall />
    case 'single_choice':
    case 'multiple_choice':
      return (
        <div className="space-y-1.5">
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-text">
              <span className={`h-4 w-4 shrink-0 border border-border-strong ${question.type === 'single_choice' ? 'rounded-full' : 'rounded'}`} />
              {opt || `Option ${i + 1}`}
            </div>
          ))}
        </div>
      )
    case 'yes_no':
      return (
        <div className="flex gap-2">
          <span className="rounded-xl border border-border px-4 py-1.5 text-sm text-text">Yes</span>
          <span className="rounded-xl border border-border px-4 py-1.5 text-sm text-text">No</span>
        </div>
      )
    default:
      return <FieldBox />
  }
}

export function QuestionnairePreview({ name, questions }: PreviewProps) {
  const answerable = questions.filter((q) => QUESTION_TYPE_META[q.type].isInput)

  return (
    <div className="pointer-events-none select-none">
      <div className="mx-auto max-w-md rounded-2xl bg-surface p-6 shadow-sm">
        <p className="mb-1 text-xs uppercase tracking-wider text-text-subtle">Preview</p>
        <h3 className="mb-5 text-xl font-semibold text-text">{name || 'Untitled questionnaire'}</h3>
        {answerable.length === 0 && questions.length === 0 ? (
          <p className="text-sm text-text-muted">Add questions to see them here.</p>
        ) : (
          <div className="space-y-5">
            {questions.map((q) => (
              <QuestionPreview key={q.id} question={q} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
