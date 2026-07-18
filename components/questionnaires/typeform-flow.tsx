/**
 * The one-question-at-a-time questionnaire renderer (typeform style).
 *
 * Purely presentational and shared by the live fill page and the MC-side
 * previews: it owns stepping, required-answer validation, keyboard advance,
 * and the pre-submit confirmation step, while answers and persistence live
 * with the caller. In `preview` mode the final send is a no-op.
 *
 * @module components/questionnaires/typeform-flow
 */
'use client'

import { useMemo, useState } from 'react'

import { buildSteps } from '@/lib/questionnaires/flow-steps'
import { missingRequiredAnswers, type Answer, type Question, type Responses } from '@/lib/questionnaires/question-schema'

import { QuestionField } from './question-field'
import { saveStateLabel, type SaveState } from './save-state'
import { readableTextOn, type QuestionnaireTheme } from './theme'

interface TypeformFlowProps {
  questions: Question[]
  responses: Responses
  onAnswer: (questionId: string, value: Answer) => void
  theme: QuestionnaireTheme
  /** `live` submits for real; `preview` renders the same UI but never sends. */
  mode: 'live' | 'preview'
  onSubmit?: () => void
  submitting?: boolean
  /** Submission failure surfaced by the caller (network / server). */
  submitError?: string | null
  saveState?: SaveState
}

export function TypeformFlow({ questions, responses, onAnswer, theme, mode, onSubmit, submitting = false, submitError = null, saveState = 'idle' }: TypeformFlowProps) {
  const { brand, textColor, mutedColor, headingColor, subheadingColor, radius, headingStack } = theme
  const steps = useMemo(() => buildSteps(questions), [questions])
  const [index, setIndex] = useState(0)
  // One index past the last question = the confirmation step.
  const [error, setError] = useState<string | null>(null)

  const total = steps.length
  // Clamp instead of resetting when the question list changes under us (the
  // builder preview edits live), so typing never yanks the preview back.
  const current = Math.min(index, total)
  const atConfirm = current >= total
  const step = steps[Math.min(current, total - 1)]
  if (!step) return null

  const canAdvance = () => missingRequiredAnswers([step.question], responses).length === 0

  // `force` skips the required check: auto-advance fires right after a choice
  // is picked, before the parent's state update lands, so validating against
  // the (stale) responses prop would wrongly block a just-answered question.
  const goNext = (force = false) => {
    if (atConfirm) {
      if (mode === 'live') onSubmit?.()
      return
    }
    if (!force && !canAdvance()) {
      setError('This one is required.')
      return
    }
    setError(null)
    setIndex(current + 1)
  }

  const goBack = () => {
    setError(null)
    setIndex(Math.max(0, current - 1))
  }

  const progress = Math.min(((current + 1) / (total + 1)) * 100, 100)
  const saveLabel = saveStateLabel(saveState)

  return (
    // A fixed column when the parent is a sized flex column (the live fill
    // page): flex-1 gives the flow a definite height, so progress and nav pin
    // in place and the step area flexes between them, scrolling internally
    // when a step is taller than the space. max-h stops the flow stretching
    // to the bottom of a tall viewport, keeping the nav near the question.
    // In previews (non-flex, auto-height parents) flex-1 is inert and the
    // same classes degrade to content sizing with the min-h floor.
    <div
      className="flex max-h-[560px] min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        // Enter advances, except inside the multi-line textarea.
        if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault()
          goNext()
        }
      }}
    >
      <div className="mb-2 h-1 w-full shrink-0 overflow-hidden rounded-full" style={{ background: `${textColor}14` }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: brand }} />
      </div>
      <p className="mb-6 min-h-4 shrink-0 text-right text-xs" style={{ color: saveState === 'error' ? '#dc2626' : mutedColor }}>{saveLabel}</p>

      {atConfirm ? (
        <div className="min-h-[300px] flex-1 overflow-y-auto">
          <h2 className="mb-2 text-2xl font-semibold" style={{ color: headingColor, fontFamily: headingStack }}>
            Ready to send your answers?
          </h2>
          <p className="text-sm" style={{ color: mutedColor }}>
            You can go back and change anything before sending.
            {mode === 'preview' && ' (Preview only, nothing is sent.)'}
          </p>
        </div>
      ) : (
        <div className="min-h-[300px] flex-1 overflow-y-auto">
          {step.section && <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: subheadingColor }}>{step.section}</p>}
          <h2 className="mb-2 text-2xl font-semibold" style={{ color: headingColor, fontFamily: headingStack }}>
            {step.question.label}
            {step.question.required && <span style={{ color: brand }}> *</span>}
          </h2>
          {step.question.help_text ? <p className="mb-5 text-sm" style={{ color: mutedColor }}>{step.question.help_text}</p> : <div className="mb-5" />}

          <QuestionField
            key={step.question.id}
            question={step.question}
            value={responses[step.question.id]}
            onChange={(v) => {
              setError(null)
              onAnswer(step.question.id, v)
            }}
            onAutoAdvance={() => goNext(true)}
            autoFocus={mode === 'live'}
            theme={theme}
          />
        </div>
      )}

      {(error || submitError) && <p className="mt-3 shrink-0 text-sm" style={{ color: '#dc2626' }}>{error ?? submitError}</p>}

      <div className="mt-8 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={current === 0}
          className="cursor-pointer text-sm disabled:opacity-0"
          style={{ color: mutedColor }}
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: mutedColor }}>
            {atConfirm ? `${total} of ${total}` : `${current + 1} of ${total}`}
          </span>
          <button
            type="button"
            onClick={() => goNext()}
            disabled={submitting}
            className="cursor-pointer px-6 py-2.5 text-base font-medium transition hover:opacity-90 disabled:opacity-60"
            style={{ background: brand, color: readableTextOn(brand), borderRadius: radius }}
          >
            {submitting ? 'Sending…' : atConfirm ? 'Send answers' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
