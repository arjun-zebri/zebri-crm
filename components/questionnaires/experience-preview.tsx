/**
 * Faithful, interactive preview of a questionnaire exactly as the couple will
 * receive it — the same branded chrome and the same renderers ({@link
 * TypeformFlow} / {@link ClassicForm}) as the public fill page, driven by the
 * MC's real branding. Local-only: answers live in component state and nothing
 * is saved or submitted. Shared by the template builder and the send flow so
 * "what you preview" is always "what goes out".
 *
 * @module components/questionnaires/experience-preview
 */
'use client'

import { useState } from 'react'

import { useCurrentBranding } from '@/lib/branding/use-current-branding'
import type { Answer, Question, QuestionnaireDisplayMode, Responses } from '@/lib/questionnaires/question-schema'

import { ClassicForm } from './classic-form'
import { themeFromBranding } from './theme'
import { TypeformFlow } from './typeform-flow'

interface ExperiencePreviewProps {
  title: string
  questions: Question[]
  displayMode: QuestionnaireDisplayMode
  /** Constrain the page frame to a phone-ish width or let it breathe. */
  frame?: 'mobile' | 'desktop'
  /** Tailwind height class for the fixed frame; content scrolls inside. */
  heightClass?: string
}

export function QuestionnaireExperiencePreview({ title, questions, displayMode, frame = 'desktop', heightClass = 'h-[560px]' }: ExperiencePreviewProps) {
  const { branding, loading } = useCurrentBranding('quote')
  const theme = themeFromBranding(branding)
  const [responses, setResponses] = useState<Responses>({})

  const onAnswer = (questionId: string, value: Answer) => setResponses((r) => ({ ...r, [questionId]: value }))

  if (questions.length === 0) {
    return <p className="text-sm text-text-muted">Add questions to see them here.</p>
  }

  // Hold a quiet skeleton until the MC's branding resolves — rendering the
  // default palette first would flash the wrong brand colour for a beat.
  if (loading && !branding) {
    return <div className={`${heightClass} animate-pulse rounded-2xl bg-surface-muted`} />
  }

  return (
    // Fixed height so the surrounding modal/panel never resizes as the
    // preview moves between questions; the page scrolls internally, exactly
    // like a phone viewport would.
    <div
      className={`flex ${heightClass} flex-col overflow-y-auto rounded-2xl p-6 sm:p-8`}
      style={{ background: theme.pageBg, color: theme.textColor, fontFamily: theme.bodyStack }}
    >
      {/* The live typeform page centres the question vertically in the
          viewport; `my-auto` mirrors that here (and still scrolls when a
          question is taller than the frame). The classic form reads top-down,
          so it stays top-aligned. */}
      <div className={`mx-auto w-full ${displayMode === 'typeform' ? 'my-auto' : ''} ${frame === 'mobile' ? 'max-w-sm' : 'max-w-xl'}`}>
        {/* Brand header — logo + business name, as on the live page. */}
        <div className="mb-8 flex items-center gap-3">
          {theme.logoUrl ? (
            // User-uploaded brand asset, not a next/image source.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : null}
          <span className="text-sm font-medium" style={{ color: theme.mutedColor }}>
            {theme.businessName}
          </span>
        </div>

        <h1 className="mb-8 text-3xl font-semibold" style={{ color: theme.textColor, fontFamily: theme.headingStack }}>
          {title || 'Untitled questionnaire'}
        </h1>

        {displayMode === 'form' ? (
          <ClassicForm questions={questions} responses={responses} onAnswer={onAnswer} theme={theme} mode="preview" />
        ) : (
          <TypeformFlow questions={questions} responses={responses} onAnswer={onAnswer} theme={theme} mode="preview" />
        )}
      </div>
    </div>
  )
}
