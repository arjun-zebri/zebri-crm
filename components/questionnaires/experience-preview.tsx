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
  description?: string | null
  questions: Question[]
  displayMode: QuestionnaireDisplayMode
  /** Constrain the page frame to a phone-ish width or let it breathe. */
  frame?: 'mobile' | 'desktop'
  /** Tailwind height class for the fixed frame; content scrolls inside. */
  heightClass?: string
}

export function QuestionnaireExperiencePreview({ title, description, questions, displayMode, frame = 'desktop', heightClass = 'h-[560px]' }: ExperiencePreviewProps) {
  const { branding, loading } = useCurrentBranding('questionnaire')
  const theme = themeFromBranding(branding)
  const [responses, setResponses] = useState<Responses>({})

  const onAnswer = (questionId: string, value: Answer) => setResponses((r) => ({ ...r, [questionId]: value }))

  if (questions.length === 0) {
    return <p style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>Add questions to see them here.</p>
  }

  // Hold a quiet skeleton until the MC's branding resolves — rendering the
  // default palette first would flash the wrong brand colour for a beat.
  if (loading && !branding) {
    return <div className={`${heightClass} animate-pulse rounded-control`} style={{ backgroundColor: theme.pageBg, opacity: 0.5 }} />
  }

  return (
    // Fixed height so the surrounding modal/panel never resizes as the
    // preview moves between questions; the page scrolls internally, exactly
    // like a phone viewport would.
    <div
      className={`flex ${heightClass} flex-col rounded-control p-6 sm:p-8 ${displayMode === 'form' ? 'overflow-y-auto' : ''}`}
      style={{ background: theme.pageBg, color: theme.textColor, fontFamily: theme.bodyStack }}
    >
      {displayMode === 'typeform' ? (
        // Typeform mode: the content sizes to its own height and sits at the
        // top of the frame, so brand, title, question and nav stay grouped
        // and read in order. Stretching it with a flex-1 chain pushed the
        // progress bar into the middle of the frame and the Next button off
        // the bottom, with a dead gap under every short question; centring it
        // instead just moved that gap above the title. The flow still handles
        // its own internal scroll when a step outgrows its space.
        <div className={`mx-auto w-full ${frame === 'mobile' ? 'max-w-sm' : 'max-w-xl'}`}>
          {/* Brand header: logo + business name, as on the live page. */}
          <div className="mb-8 flex items-center gap-3">
            {theme.logoUrl ? (
              // User-uploaded brand asset, not a next/image source.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-9 w-9 rounded-pill object-cover" />
            ) : null}
            <span style={{ fontSize: `${theme.bodyFontSize}px`, fontWeight: 500, color: theme.mutedColor }}>
              {theme.businessName}
            </span>
          </div>

          <h1 className="mb-8 font-semibold" style={{ fontSize: `${theme.docTitleFontSize}px`, color: theme.textColor, fontFamily: theme.headingStack }}>
            {title || 'Untitled questionnaire'}
          </h1>
          {description && (
            <p className="mb-8" style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>
              {description}
            </p>
          )}
          <TypeformFlow questions={questions} responses={responses} onAnswer={onAnswer} theme={theme} mode="preview" branding={branding!} />
        </div>
      ) : (
        // Form mode: classic all-on-one-page layout that scrolls internally.
        <div className={`mx-auto w-full ${frame === 'mobile' ? 'max-w-sm' : 'max-w-xl'}`}>
          {/* Brand header: logo + business name, as on the live page. */}
          <div className="mb-8 flex items-center gap-3">
            {theme.logoUrl ? (
              // User-uploaded brand asset, not a next/image source.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-9 w-9 rounded-pill object-cover" />
            ) : null}
            <span style={{ fontSize: `${theme.bodyFontSize}px`, fontWeight: 500, color: theme.mutedColor }}>
              {theme.businessName}
            </span>
          </div>

          <h1 className="mb-8 font-semibold" style={{ fontSize: `${theme.docTitleFontSize}px`, color: theme.textColor, fontFamily: theme.headingStack }}>
            {title || 'Untitled questionnaire'}
          </h1>
          {description && (
            <p className="mb-8" style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>
              {description}
            </p>
          )}

          <ClassicForm questions={questions} responses={responses} onAnswer={onAnswer} theme={theme} mode="preview" branding={branding!} />
        </div>
      )}
    </div>
  )
}
