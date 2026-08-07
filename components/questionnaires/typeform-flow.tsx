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

import { useMemo, useState, type CSSProperties } from 'react'

import { BusyLabel } from '@/components/ui/busy-label'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'
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
  /** Required: the MC's resolved branding for typography roles and styling. */
  branding: PublicBranding
  /** Optional question-heading typography override from the form-style block. */
  questionCss?: CSSProperties
  /** Optional answer typography override from the form-style block. */
  answerCss?: CSSProperties
  /** Optional Next/Send button background from the form-style block. */
  buttonColor?: string
}

export function TypeformFlow({ questions, responses, onAnswer, theme, mode, onSubmit, submitting = false, submitError = null, saveState = 'idle', branding, questionCss, answerCss, buttonColor }: TypeformFlowProps) {
  const { brand, textColor, mutedColor } = theme
  const steps = useMemo(() => buildSteps(questions), [questions])
  const [index, setIndex] = useState(0)
  // One index past the last question = the confirmation step.
  const [error, setError] = useState<string | null>(null)

  // Resolve typography roles for use in the flow.
  const sectionLabelStyles = roleDefaults(branding, 'sectionLabel')
  const questionHeadingStyles = roleDefaults(branding, 'sectionHeading')
  const bodyStyles = roleDefaults(branding, 'body')

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
      <div className="mb-2 h-1 w-full shrink-0 overflow-hidden rounded-pill" style={{ background: `${textColor}14` }}>
        <div className="h-full rounded-pill transition-all" style={{ width: `${progress}%`, background: brand }} />
      </div>
      <p className="mb-6 min-h-4 shrink-0 text-right" style={{ color: saveState === 'error' ? STATUS_COLORS.error : mutedColor, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, lineHeight: bodyStyles.lineHeight }}>{saveLabel}</p>

      {atConfirm ? (
        <div className="min-h-[300px] flex-1 overflow-y-auto">
          <h2 style={{ color: questionHeadingStyles.color, fontSize: `${questionHeadingStyles.fontSize}px`, fontFamily: questionHeadingStyles.fontFamily, fontWeight: questionHeadingStyles.fontWeight, lineHeight: questionHeadingStyles.lineHeight, marginBottom: '0.5rem' }}>
            Ready to send your answers?
          </h2>
          <p style={{ color: bodyStyles.color, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, lineHeight: bodyStyles.lineHeight }}>
            You can go back and change anything before sending.
            {mode === 'preview' && ' (Preview only, nothing is sent.)'}
          </p>
        </div>
      ) : (
        <div className="min-h-[300px] flex-1 overflow-y-auto">
          {step.section && <p className="mb-2" style={{ color: sectionLabelStyles.color, fontSize: `${sectionLabelStyles.fontSize}px`, fontFamily: sectionLabelStyles.fontFamily, fontWeight: sectionLabelStyles.fontWeight, textTransform: sectionLabelStyles.textTransform, letterSpacing: `${sectionLabelStyles.letterSpacing}em`, lineHeight: sectionLabelStyles.lineHeight }}>{step.section}</p>}
          <h2 style={{ color: questionHeadingStyles.color, fontSize: `${questionHeadingStyles.fontSize}px`, fontFamily: questionHeadingStyles.fontFamily, fontWeight: questionHeadingStyles.fontWeight, lineHeight: questionHeadingStyles.lineHeight, ...questionCss, marginBottom: '0.5rem' }}>
            {step.question.label}
            {step.question.required && <span style={{ color: brand }}> *</span>}
          </h2>
          {step.question.help_text ? <p style={{ color: bodyStyles.color, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, marginBottom: '1.25rem', lineHeight: bodyStyles.lineHeight }}>{step.question.help_text}</p> : <div className="mb-5" />}

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
            {...(answerCss ? { answerCss } : {})}
          />
        </div>
      )}

      {(error || submitError) && <p className="mt-3 shrink-0" style={{ color: STATUS_COLORS.error, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight, lineHeight: bodyStyles.lineHeight }}>{error ?? submitError}</p>}

      <div className="mt-8 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={current === 0}
          className="cursor-pointer disabled:opacity-0"
          style={{ color: mutedColor, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight }}
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <span style={{ color: mutedColor, fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight }}>
            {atConfirm ? `${total} of ${total}` : `${current + 1} of ${total}`}
          </span>
          <button
            type="button"
            onClick={() => goNext()}
            disabled={submitting}
            className="cursor-pointer transition hover:opacity-90 disabled:opacity-60"
            style={{ background: buttonColor ?? brand, color: readableTextOn(buttonColor ?? brand), borderRadius: branding.corner_radius, padding: '0.625rem 1.5rem', fontSize: `${bodyStyles.fontSize}px`, fontFamily: bodyStyles.fontFamily, fontWeight: bodyStyles.fontWeight }}
          >
            <BusyLabel busy={submitting}>{atConfirm ? 'Send answers' : 'Next'}</BusyLabel>
          </button>
        </div>
      </div>
    </div>
  )
}
