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

import { useState, type CSSProperties } from 'react'

import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'
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
  /** Required: the MC's resolved branding for typography roles and styling. */
  branding: PublicBranding
  /** Optional question-heading typography override from the form-style block. */
  questionCss?: CSSProperties
  /** Optional answer typography override from the form-style block. */
  answerCss?: CSSProperties
  /** Optional submit-button background from the form-style block. */
  buttonColor?: string
}

export function ClassicForm({ questions, responses, onAnswer, theme, mode, onSubmit, submitting = false, submitError = null, saveState = 'idle', branding, questionCss, answerCss, buttonColor }: ClassicFormProps) {
  const { brand, mutedColor } = theme
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const saveLabel = saveStateLabel(saveState)

  // Resolve typography roles for use in the form.
  const sectionLabelStyles = roleDefaults(branding, 'sectionLabel')
  const questionHeadingStyles = roleDefaults(branding, 'sectionHeading')
  const bodyStyles = roleDefaults(branding, 'body')

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
      <p className="mb-4 min-h-4 text-right" style={{ color: saveState === 'error' ? STATUS_COLORS.error : mutedColor, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, lineHeight: bodyStyles.lineHeight }}>{saveLabel}</p>

      <div className="space-y-8">
        {questions.map((q) => {
          if (q.type === 'section') {
            return (
              <h2 key={q.id} className="pt-2" style={{ color: sectionLabelStyles.color, fontSize: `${sectionLabelStyles.fontSize}px`, fontFamily: sectionLabelStyles.fontFamily, fontWeight: sectionLabelStyles.fontWeight, textTransform: sectionLabelStyles.textTransform, letterSpacing: `${sectionLabelStyles.letterSpacing}em`, lineHeight: sectionLabelStyles.lineHeight }}>
                {q.label}
              </h2>
            )
          }
          if (!QUESTION_TYPE_META[q.type].isInput) return null
          return (
            <div key={q.id} id={`question-${q.id}`}>
              <h3 style={{ color: questionHeadingStyles.color, fontSize: `${questionHeadingStyles.fontSize}px`, fontFamily: questionHeadingStyles.fontFamily, fontWeight: questionHeadingStyles.fontWeight, lineHeight: questionHeadingStyles.lineHeight, ...questionCss, marginBottom: '0.375rem' }}>
                {q.label}
                {q.required && <span style={{ color: brand }}> *</span>}
              </h3>
              {q.help_text && <p style={{ color: bodyStyles.color, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, marginBottom: '0.75rem', lineHeight: bodyStyles.lineHeight }}>{q.help_text}</p>}
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
                {...(answerCss ? { answerCss } : {})}
              />
              {missing.has(q.id) && <p style={{ color: STATUS_COLORS.error, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, marginTop: '0.5rem', lineHeight: bodyStyles.lineHeight }}>This one is required.</p>}
            </div>
          )
        })}
      </div>

      {submitError && <p style={{ color: STATUS_COLORS.error, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, marginTop: '1rem', lineHeight: bodyStyles.lineHeight }}>{submitError}</p>}

      <div className="mt-10 flex flex-col items-start gap-3">
        {confirming && (
          <p style={{ color: mutedColor, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, lineHeight: bodyStyles.lineHeight }}>
            Ready to send your answers? You can still scroll up and change anything.
            {mode === 'preview' && ' (Preview only, nothing is sent.)'}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={submitting}
            className="cursor-pointer transition hover:opacity-90 disabled:opacity-60"
            style={{ background: buttonColor ?? brand, color: readableTextOn(buttonColor ?? brand), borderRadius: branding.corner_radius, padding: '0.625rem 1.5rem', fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight }}
          >
            {submitting ? 'Sending…' : confirming ? 'Send answers' : 'Submit'}
          </button>
          {confirming && !submitting && (
            <button type="button" onClick={() => setConfirming(false)} style={{ color: mutedColor, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight }} className="cursor-pointer">
              Keep editing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
