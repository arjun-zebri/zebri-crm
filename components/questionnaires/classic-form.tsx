/**
 * The all-questions-on-one-page questionnaire renderer (classic form style).
 *
 * The alternative to {@link TypeformFlow} for MCs who prefer a traditional
 * form: every question stacked under its section headings, one submit at the
 * bottom with the same required-answer validation and pre-submit confirmation.
 * Purely presentational — answers and persistence live with the caller — and
 * shared by the live fill page and the MC-side previews.
 *
 * @module components/questionnaires/classic-form
 */
'use client'

import { useState } from 'react'

import { missingRequiredAnswers, QUESTION_TYPE_META, type Answer, type Question, type Responses } from '@/lib/questionnaires/question-schema'

import { QuestionField } from './question-field'
import { saveStateLabel, type SaveState } from './save-state'
import { readableTextOn, type QuestionnaireTheme } from './theme'

interface ClassicFormProps {
  questions: Question[]
  responses: Responses
  onAnswer: (questionId: string, value: Answer) => void
  theme: QuestionnaireTheme
  /** `live` submits for real; `preview` renders the same UI but never sends. */
  mode: 'live' | 'preview'
  onSubmit?: () => void
  submitting?: boolean
  submitError?: string | null
  saveState?: SaveState
}

export function ClassicForm({ questions, responses, onAnswer, theme, mode, onSubmit, submitting = false, submitError = null, saveState = 'idle' }: ClassicFormProps) {
  const { brand, textColor, mutedColor, headingColor, subheadingColor, radius, headingStack } = theme
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const saveLabel = saveStateLabel(saveState)

  const handleSubmitClick = () => {
    const missingIds = missingRequiredAnswers(questions, responses)
    if (missingIds.length > 0) {
      setMissing(new Set(missingIds))
      setConfirming(false)
      document.getElementById(`question-${missingIds[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setMissing(new Set())
    if (!confirming) {
      setConfirming(true)
      return
    }
    if (mode === 'live') onSubmit?.()
  }

  return (
    <div>
      <p className="mb-4 min-h-4 text-right text-xs" style={{ color: saveState === 'error' ? '#dc2626' : mutedColor }}>{saveLabel}</p>

      <div className="space-y-8">
        {questions.map((q) => {
          if (q.type === 'section') {
            return (
              <h2 key={q.id} className="pt-2 text-xs font-medium uppercase tracking-wider" style={{ color: subheadingColor }}>
                {q.label}
              </h2>
            )
          }
          if (!QUESTION_TYPE_META[q.type].isInput) return null
          return (
            <div key={q.id} id={`question-${q.id}`}>
              <h3 className="mb-1.5 text-lg font-semibold" style={{ color: headingColor, fontFamily: headingStack }}>
                {q.label}
                {q.required && <span style={{ color: brand }}> *</span>}
              </h3>
              {q.help_text && <p className="mb-3 text-sm" style={{ color: mutedColor }}>{q.help_text}</p>}
              <QuestionField
                question={q}
                value={responses[q.id]}
                onChange={(v) => {
                  setMissing((m) => {
                    if (!m.has(q.id)) return m
                    const next = new Set(m)
                    next.delete(q.id)
                    return next
                  })
                  onAnswer(q.id, v)
                }}
                theme={theme}
              />
              {missing.has(q.id) && <p className="mt-2 text-sm" style={{ color: '#dc2626' }}>This one is required.</p>}
            </div>
          )
        })}
      </div>

      {submitError && <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>{submitError}</p>}

      <div className="mt-10 flex flex-col items-start gap-3">
        {confirming && (
          <p className="text-sm" style={{ color: mutedColor }}>
            Ready to send your answers? You can still scroll up and change anything.
            {mode === 'preview' && ' (Preview only, nothing is sent.)'}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={submitting}
            className="cursor-pointer px-6 py-2.5 text-base font-medium transition hover:opacity-90 disabled:opacity-60"
            style={{ background: brand, color: readableTextOn(brand), borderRadius: radius }}
          >
            {submitting ? 'Sending…' : confirming ? 'Send answers' : 'Submit'}
          </button>
          {confirming && !submitting && (
            <button type="button" onClick={() => setConfirming(false)} className="cursor-pointer text-sm" style={{ color: mutedColor }}>
              Keep editing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
