/**
 * The one-question-at-a-time questionnaire flow.
 *
 * Walks the couple through each answerable question with a progress bar,
 * keyboard advance, and debounced autosave. Section headings render as a quiet
 * eyebrow above the question that follows them. Submitting calls the public
 * submit endpoint and hands control back to the page for the thank-you state.
 *
 * @module app/questionnaire/[token]/_components/questionnaire-flow
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { QUESTION_TYPE_META, missingRequiredAnswers, type Answer, type Responses } from '@/lib/questionnaires/question-schema'

import { readableTextOn, type PublicQuestionnaire } from './public-questionnaire'
import { QuestionField } from './question-field'

interface FlowProps {
  questionnaire: PublicQuestionnaire
  token: string
  brand: string
  textColor: string
  mutedColor: string
  radius: number
  headingStack: string | undefined
  onCompleted: () => void
}

export function QuestionnaireFlow({ questionnaire, token, brand, textColor, mutedColor, radius, headingStack, onCompleted }: FlowProps) {
  const { questions, responses: initialResponses } = questionnaire
  const [responses, setResponses] = useState<Responses>(initialResponses ?? {})
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Steps are the answerable questions; each carries the section heading (if
  // any) that immediately precedes it for context.
  const steps = useMemo(() => {
    let section: string | null = null
    const out: { question: (typeof questions)[number]; section: string | null }[] = []
    for (const q of questions) {
      if (q.type === 'section') section = q.label
      else if (QUESTION_TYPE_META[q.type].isInput) out.push({ question: q, section })
    }
    return out
  }, [questions])

  const total = steps.length
  const step = steps[index]

  // Debounced autosave whenever answers change. Fire-and-forget: a failed
  // autosave is retried on the next change and on final submit.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void fetch('/api/questionnaire/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses }),
      }).catch(() => {})
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [responses, token])

  if (!step) return null

  const setAnswer = (value: Answer) => {
    setError(null)
    setResponses((r) => ({ ...r, [step.question.id]: value }))
  }

  const canAdvance = () => missingRequiredAnswers([step.question], responses).length === 0

  const goNext = () => {
    if (!canAdvance()) {
      setError('This one is required.')
      return
    }
    if (index < total - 1) {
      setIndex((i) => i + 1)
      setError(null)
    } else {
      void submit()
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/questionnaire/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, responses }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    setSubmitting(false)
    if (!res.ok || data.error) {
      setError('Something went wrong. Please try again.')
      return
    }
    onCompleted()
  }

  const isLast = index === total - 1

  return (
    <div
      onKeyDown={(e) => {
        // Enter advances, except inside the multi-line textarea.
        if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault()
          goNext()
        }
      }}
    >
      <div className="mb-8 h-1 w-full overflow-hidden rounded-full" style={{ background: '#00000014' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${((index + 1) / total) * 100}%`, background: brand }} />
      </div>

      {step.section && <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>{step.section}</p>}

      <h2 className="mb-2 text-2xl font-semibold" style={{ color: textColor, fontFamily: headingStack }}>
        {step.question.label}
        {step.question.required && <span style={{ color: brand }}> *</span>}
      </h2>
      {step.question.help_text && <p className="mb-5 text-sm" style={{ color: mutedColor }}>{step.question.help_text}</p>}
      {!step.question.help_text && <div className="mb-5" />}

      <QuestionField
        question={step.question}
        value={responses[step.question.id]}
        onChange={setAnswer}
        onAutoAdvance={() => !isLast && goNext()}
        brand={brand}
        textColor={textColor}
        radius={radius}
      />

      {error && <p className="mt-3 text-sm" style={{ color: '#dc2626' }}>{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="cursor-pointer text-sm disabled:opacity-0"
          style={{ color: mutedColor }}
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: mutedColor }}>{index + 1} of {total}</span>
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            className="cursor-pointer px-6 py-2.5 text-base font-medium transition hover:opacity-90 disabled:opacity-60"
            style={{ background: brand, color: readableTextOn(brand), borderRadius: radius }}
          >
            {submitting ? 'Sending…' : isLast ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
