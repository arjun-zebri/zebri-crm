/**
 * Read-only rendering of a couple's questionnaire answers, shown in the side
 * panel on the couple profile. Sections render as quiet headings; each
 * answered question shows its label and the couple's response, with an em-free
 * placeholder when unanswered.
 *
 * @module app/(dashboard)/couples/couple-questionnaire-answers
 */
'use client'

import { QUESTION_TYPE_META, type Question, type Responses } from '@/lib/questionnaires/question-schema'

interface AnswersProps {
  questions: Question[]
  responses: Responses
}

/** Formats a stored answer value for display. */
function formatAnswer(value: Responses[string] | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function CoupleQuestionnaireAnswers({ questions, responses }: AnswersProps) {
  if (questions.length === 0) {
    return <p className="text-sm text-text-muted">This questionnaire has no questions.</p>
  }

  return (
    <div className="space-y-5">
      {questions.map((q) => {
        if (q.type === 'section') {
          return (
            <h4 key={q.id} className="pt-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {q.label}
            </h4>
          )
        }
        if (!QUESTION_TYPE_META[q.type].isInput) return null
        const answer = formatAnswer(responses[q.id])
        return (
          <div key={q.id}>
            <p className="text-sm font-medium text-text">{q.label}</p>
            {answer ? (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-muted">{answer}</p>
            ) : (
              <p className="mt-0.5 text-sm text-text-subtle">No answer</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
