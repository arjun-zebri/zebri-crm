/**
 * The active fill experience on the public questionnaire page: wires the
 * loaded questionnaire into {@link useQuestionnaireFill} and renders the
 * right renderer for its display mode (one question at a time or classic
 * form), with optional welcome screen in typeform mode and pre/post blocks
 * from the MC's branding.
 *
 * Mounted only once the questionnaire has loaded, so the hook starts
 * from the couple's saved draft.
 *
 * @module app/questionnaire/[token]/_components/fill-section
 */
'use client'

import { useState } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ClassicForm } from '@/components/questionnaires/classic-form'
import type { QuestionnaireTheme } from '@/components/questionnaires/theme'
import { readableTextOn } from '@/components/questionnaires/theme'
import { TypeformFlow } from '@/components/questionnaires/typeform-flow'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { buildSteps } from '@/lib/questionnaires/flow-steps'

import type { PublicQuestionnaire } from './public-questionnaire'
import { useQuestionnaireFill } from './use-questionnaire-fill'

interface FillSectionProps {
  questionnaire: PublicQuestionnaire
  token: string
  theme: QuestionnaireTheme
  onCompleted: () => void
  preBlocks?: Block[]
  postBlocks?: Block[]
  showWelcome?: boolean
}

/** Empty doc data for rendering pre/post blocks. */
const QUESTIONNAIRE_DOC: PublicDocData = {
  title: '',
  refNumber: '',
  expiresAt: null,
  items: [],
  subtotal: 0,
  taxRate: 0,
}

export function FillSection({
  questionnaire,
  token,
  theme,
  onCompleted,
  preBlocks = [],
  postBlocks = [],
  showWelcome = false,
}: FillSectionProps) {
  const fill = useQuestionnaireFill(token, questionnaire.responses ?? null, onCompleted)
  const questionCount = buildSteps(questionnaire.questions).length
  const isTypeform = questionnaire.display_mode === 'typeform'

  // Typeform welcome screen: shown before the first question.
  const [welcomeComplete, setWelcomeComplete] = useState(!showWelcome)

  const Renderer = isTypeform ? TypeformFlow : ClassicForm

  // Resolve button typography for consistent styling across the section.
  const buttonStyles = roleDefaults(questionnaire, 'body')

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
    branding: questionnaire,
  }

  // Typeform welcome screen (pre-blocks + Start button).
  if (isTypeform && showWelcome && !welcomeComplete) {
    const startButtonBg = readableTextOn(theme.brand)
    return (
      <div className="flex min-h-0 flex-1 flex-col py-6">
        <div className="flex-1 flex flex-col justify-center">
          {preBlocks.length > 0 && (
            <div className="mb-8">
              <PublicBlockRenderer
                blocks={preBlocks}
                branding={questionnaire}
                doc={QUESTIONNAIRE_DOC}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setWelcomeComplete(true)}
            className="mt-6 self-start font-medium transition cursor-pointer"
            style={{
              backgroundColor: theme.brand,
              color: startButtonBg,
              borderRadius: questionnaire.corner_radius,
              padding: '0.75rem 2rem',
              fontSize: `${buttonStyles.fontSize}px`,
              fontFamily: buttonStyles.fontFamily,
              fontWeight: buttonStyles.fontWeight,
            }}
          >
            Start
          </button>
        </div>
      </div>
    )
  }

  // Form mode: pre-blocks above, questions in middle, post-blocks below.
  if (!isTypeform) {
    return (
      <div className="py-6">
        {preBlocks.length > 0 && (
          <div className="mb-10">
            <PublicBlockRenderer
              blocks={preBlocks}
              branding={questionnaire}
              doc={QUESTIONNAIRE_DOC}
            />
          </div>
        )}

        <h1 className="mb-1.5 font-semibold" style={{ fontSize: '30px', color: theme.textColor, fontFamily: theme.headingStack }}>
          {questionnaire.title}
        </h1>
        <p className="mb-8" style={{ fontSize: '14px', color: theme.mutedColor }}>
          {questionCount} question{questionCount === 1 ? '' : 's'} · your answers save as you go
        </p>

        <Renderer {...rendererProps} />

        {postBlocks.length > 0 && (
          <div className="mt-10 pt-6 border-t" style={{ borderColor: theme.mutedColor + '30' }}>
            <PublicBlockRenderer
              blocks={postBlocks}
              branding={questionnaire}
              doc={QUESTIONNAIRE_DOC}
            />
          </div>
        )}
      </div>
    )
  }

  // Typeform mode (no welcome screen): just the questions.
  return (
    <div className="flex min-h-0 flex-1 flex-col py-6">
      <h1 className="mb-1.5 shrink-0 font-semibold" style={{ fontSize: '30px', color: theme.textColor, fontFamily: theme.headingStack }}>
        {questionnaire.title}
      </h1>
      <p className="mb-8 shrink-0" style={{ fontSize: '14px', color: theme.mutedColor }}>
        {questionCount} question{questionCount === 1 ? '' : 's'} · your answers save as you go
      </p>
      {/* No wrapper around the typeform flow: its root carries `flex-1` so it
          becomes the flex item itself. An intermediate div's flexed height is
          not "definite" for a child's h-full, which quietly re-enables
          content sizing (the jumpy-nav bug). */}
      <Renderer {...rendererProps} />
      {postBlocks.length > 0 && (
        <div className="mt-10 pt-6 border-t" style={{ borderColor: theme.mutedColor + '30' }}>
          <PublicBlockRenderer
            blocks={postBlocks}
            branding={questionnaire}
            doc={QUESTIONNAIRE_DOC}
          />
        </div>
      )}
    </div>
  )
}
