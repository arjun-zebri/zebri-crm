/**
 * A couple's questionnaire answers on the couple profile: read-only by
 * default with sent/opened/completed metadata, a print/PDF export, and an
 * edit mode so the MC can fill or correct answers on the couple's behalf
 * (details collected over the phone land in the same place). Editing reuses
 * the shared {@link QuestionField} controls and saves through the parent's
 * RLS-scoped mutation.
 *
 * @module app/(dashboard)/couples/couple-questionnaire-answers
 */
'use client'

import { Pencil, Printer } from 'lucide-react'
import { useState } from 'react'

import { QuestionField } from '@/components/questionnaires/question-field'
import { themeFromBranding } from '@/components/questionnaires/theme'
import { Button } from '@/components/ui/button'
import { answersPrintHtml, formatAnswer } from '@/lib/questionnaires/answers-html'
import { QUESTION_TYPE_META, type Question, type Responses } from '@/lib/questionnaires/question-schema'

interface AnswersProps {
  title: string
  coupleName: string
  sentAt: string | null
  completedAt: string | null
  questions: Question[]
  responses: Responses
  onSaveResponses: (responses: Responses) => Promise<void>
  saving: boolean
}

/** Neutral theme for the MC-side edit controls (no couple branding here). */
const EDIT_THEME = themeFromBranding(null)

function fmtDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CoupleQuestionnaireAnswers({ title, coupleName, sentAt, completedAt, questions, responses, onSaveResponses, saving }: AnswersProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Responses>(responses)

  if (questions.length === 0) {
    return <p className="text-body text-text-muted">This questionnaire has no questions.</p>
  }

  const meta = [sentAt ? `Sent ${fmtDate(sentAt)}` : 'Not sent yet', completedAt ? `Completed ${fmtDate(completedAt)}` : null]
    .filter(Boolean)
    .join(' · ')

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    w.document.write(answersPrintHtml({ title, coupleName, completedAt, questions, responses }))
    w.document.close()
    w.focus()
    w.print()
  }

  const handleSave = async () => {
    await onSaveResponses(draft)
    setEditing(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-text-muted">{meta}</p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { setDraft(responses); setEditing(false) }} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save answers'}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
                <Printer size={14} strokeWidth={1.5} />
                Print / PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setDraft(responses); setEditing(true) }} className="gap-1.5">
                <Pencil size={14} strokeWidth={1.5} />
                Edit answers
              </Button>
            </>
          )}
        </div>
      </div>

      {questions.map((q) => {
        if (q.type === 'section') {
          return (
            <h4 key={q.id} className="pt-2 text-caption font-semibold uppercase tracking-wider text-text-muted">
              {q.label}
            </h4>
          )
        }
        if (!QUESTION_TYPE_META[q.type].isInput) return null
        if (editing) {
          return (
            <div key={q.id}>
              <p className="mb-1.5 text-body font-medium text-text">{q.label}</p>
              <QuestionField
                question={q}
                value={draft[q.id]}
                onChange={(v) => setDraft((d) => ({ ...d, [q.id]: v }))}
                theme={EDIT_THEME}
              />
            </div>
          )
        }
        const answer = formatAnswer(responses[q.id])
        return (
          <div key={q.id}>
            <p className="text-body font-medium text-text">{q.label}</p>
            {answer ? (
              <p className="mt-0.5 whitespace-pre-wrap text-body text-text-muted">{answer}</p>
            ) : (
              <p className="mt-0.5 text-body italic text-text-subtle">No answer</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
