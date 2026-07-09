/**
 * The active fill experience on the public questionnaire page: wires the
 * loaded questionnaire into {@link useQuestionnaireFill} and renders the
 * right renderer for its display mode (one question at a time or classic
 * form). Mounted only once the questionnaire has loaded, so the hook starts
 * from the couple's saved draft.
 *
 * @module app/questionnaire/[token]/_components/fill-section
 */
'use client'

import { ClassicForm } from '@/components/questionnaires/classic-form'
import type { QuestionnaireTheme } from '@/components/questionnaires/theme'
import { TypeformFlow } from '@/components/questionnaires/typeform-flow'
import { buildSteps } from '@/lib/questionnaires/flow-steps'

import type { PublicQuestionnaire } from './public-questionnaire'
import { useQuestionnaireFill } from './use-questionnaire-fill'

interface FillSectionProps {
  questionnaire: PublicQuestionnaire
  token: string
  theme: QuestionnaireTheme
  onCompleted: () => void
}

export function FillSection({ questionnaire, token, theme, onCompleted }: FillSectionProps) {
  const fill = useQuestionnaireFill(token, questionnaire.responses ?? null, onCompleted)
  const questionCount = buildSteps(questionnaire.questions).length

  const Renderer = questionnaire.display_mode === 'form' ? ClassicForm : TypeformFlow

  const rendererProps = {
    questions: questionnaire.questions,
    responses: fill.responses,
    onAnswer: fill.setAnswer,
    theme,
    mode: 'live' as const,
    onSubmit: fill.submit,
    submitting: fill.submitting,
    submitError: fill.submitError,
    saveState: fill.saveState,
  }

  return (
    // Typeform mode fills the remaining viewport height so the flow's
    // progress bar and nav pin in place while questions change; the classic
    // form reads top-down and scrolls the page naturally.
    <div className={`py-6 ${questionnaire.display_mode === 'form' ? '' : 'flex min-h-0 flex-1 flex-col'}`}>
      <h1 className="mb-1.5 shrink-0 text-3xl font-semibold" style={{ color: theme.textColor, fontFamily: theme.headingStack }}>
        {questionnaire.title}
      </h1>
      <p className="mb-8 shrink-0 text-sm" style={{ color: theme.mutedColor }}>
        {questionCount} question{questionCount === 1 ? '' : 's'} · your answers save as you go
      </p>
      {/* No wrapper around the typeform flow: its root carries `flex-1` so it
          becomes the flex item itself. An intermediate div's flexed height is
          not "definite" for a child's h-full, which quietly re-enables
          content sizing (the jumpy-nav bug). */}
      <Renderer {...rendererProps} />
    </div>
  )
}
