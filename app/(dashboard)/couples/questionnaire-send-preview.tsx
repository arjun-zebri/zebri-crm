/**
 * Faithful preview of a questionnaire exactly as the couple receives it.
 *
 * Mirrors the public couple-facing page (`/questionnaire/[token]`): the same
 * branded chrome, one-question-at-a-time wizard, progress bar, and real answer
 * controls (via the shared {@link QuestionField}). Interactive but local-only,
 * nothing is saved or submitted. Shown in the couple-profile send flow so the
 * MC sees the real thing before sending, rather than a stacked mock.
 *
 * Branding comes from {@link useCurrentBranding} so the preview uses the MC's
 * actual colours/fonts/radius; it falls back to the same defaults the public
 * page uses while branding loads.
 *
 * @module app/(dashboard)/couples/questionnaire-send-preview
 */
'use client'

import { useMemo, useState } from 'react'

import { readableTextOn } from '@/app/questionnaire/[token]/_components/public-questionnaire'
import { QuestionField } from '@/app/questionnaire/[token]/_components/question-field'
import { bodyFontFamily, headingFontFamily } from '@/lib/branding/public-surface'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'
import { QUESTION_TYPE_META, type Answer, type Question, type Responses } from '@/lib/questionnaires/question-schema'

interface Props {
  name: string
  questions: Question[]
}

/** Renders the questionnaire as a couple-facing wizard preview. */
export function QuestionnaireSendPreview({ name, questions }: Props) {
  const { branding } = useCurrentBranding('quote')
  const [responses, setResponses] = useState<Responses>({})
  const [index, setIndex] = useState(0)

  // Steps are the answerable questions, each carrying the section heading (if
  // any) that immediately precedes it. Mirrors the live flow's stepping.
  const steps = useMemo(() => {
    let section: string | null = null
    const out: { question: Question; section: string | null }[] = []
    for (const q of questions) {
      if (q.type === 'section') section = q.label
      else if (QUESTION_TYPE_META[q.type].isInput) out.push({ question: q, section })
    }
    return out
  }, [questions])

  // Branding fallbacks match the public page defaults exactly.
  const brand = branding?.brand_color || '#A7F3D0'
  const pageBg = branding?.surface_color || '#fafafa'
  const textColor = branding?.text_color || '#111827'
  const mutedColor = branding?.muted_color || '#6B7280'
  const radius = branding?.corner_radius ?? 16
  const headingStack = branding ? headingFontFamily(branding) : undefined
  const bodyStack = branding ? bodyFontFamily(branding) : undefined

  const total = steps.length
  const safeIndex = Math.min(index, Math.max(0, total - 1))
  const step = steps[safeIndex]

  if (!step) {
    return <p className="text-sm text-text-muted">This questionnaire has no answerable questions yet.</p>
  }

  const setAnswer = (value: Answer) => setResponses((r) => ({ ...r, [step.question.id]: value }))
  const isLast = safeIndex === total - 1

  return (
    // Fixed height so the modal never resizes as the couple moves between
    // questions (textarea vs choices vs help text differ in height). The
    // question area scrolls internally; the nav stays pinned at the bottom.
    <div
      className="flex h-[520px] flex-col rounded-2xl p-6 sm:p-10"
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden">
        {/* Brand header — logo + business name, as on the live page. */}
        <div className="mb-8 flex shrink-0 items-center gap-3">
          {branding?.logo_url ? (
            // User-uploaded brand asset, not a next/image source.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : null}
          <span className="text-sm font-medium" style={{ color: mutedColor }}>
            {branding?.business_name || 'Your celebrant'}
          </span>
        </div>

        <h1 className="mb-8 shrink-0 text-3xl font-semibold" style={{ color: textColor, fontFamily: headingStack }}>
          {name || 'Untitled questionnaire'}
        </h1>

        <div className="mb-8 h-1 w-full shrink-0 overflow-hidden rounded-full" style={{ background: '#00000014' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${((safeIndex + 1) / total) * 100}%`, background: brand }} />
        </div>

        {/* Scrolls when a single question's content is taller than the frame,
            keeping the overall modal height constant. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {step.section && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>
              {step.section}
            </p>
          )}

          <h2 className="mb-2 text-2xl font-semibold" style={{ color: textColor, fontFamily: headingStack }}>
            {step.question.label}
            {step.question.required && <span style={{ color: brand }}> *</span>}
          </h2>
          {step.question.help_text ? (
            <p className="mb-5 text-sm" style={{ color: mutedColor }}>{step.question.help_text}</p>
          ) : (
            <div className="mb-5" />
          )}

          <QuestionField
            question={step.question}
            value={responses[step.question.id]}
            onChange={setAnswer}
            onAutoAdvance={() => !isLast && setIndex((i) => i + 1)}
            brand={brand}
            textColor={textColor}
            radius={radius}
          />
        </div>

        <div className="mt-8 flex shrink-0 items-center justify-between">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            className="cursor-pointer text-sm disabled:opacity-0"
            style={{ color: mutedColor }}
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: mutedColor }}>
              {safeIndex + 1} of {total}
            </span>
            <button
              type="button"
              onClick={() => !isLast && setIndex((i) => i + 1)}
              disabled={isLast}
              className="cursor-pointer px-6 py-2.5 text-base font-medium transition hover:opacity-90 disabled:opacity-60"
              style={{ background: brand, color: readableTextOn(brand), borderRadius: radius }}
            >
              {isLast ? 'Submit' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
