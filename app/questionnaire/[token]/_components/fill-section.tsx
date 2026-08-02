/**
 * The active fill experience on the public questionnaire page: wires the
 * loaded questionnaire into {@link useQuestionnaireFill} and renders the
 * right renderer for its display mode (one question at a time or classic
 * form), with optional welcome screen in one-at-a-time mode and pre/post blocks
 * from the MC's branding.
 *
 * Mounted only once the questionnaire has loaded, so the hook starts
 * from the couple's saved draft.
 *
 * @module app/questionnaire/[token]/_components/fill-section
 */
'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ClassicForm } from '@/components/questionnaires/classic-form'
import type { QuestionnaireTheme } from '@/components/questionnaires/theme'
import { readableTextOn } from '@/components/questionnaires/theme'
import { TypeformFlow } from '@/components/questionnaires/typeform-flow'
import { blockOuterStyle, hasOuterStyle } from '@/lib/branding/block-outer-style'
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
  /** Display mode from the questionnaire block. Defaults to 'form'. */
  displayMode?: 'form' | 'oneAtATime'
  /** The active form-style marker block, whose frame styling (background,
   *  padding, border, radius, width) wraps the questions area. Absent for legacy
   *  questionnaires with no form-style block. */
  formBlock?: Block
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
  displayMode = 'form',
  formBlock,
}: FillSectionProps) {
  const fill = useQuestionnaireFill(token, questionnaire.responses ?? null, onCompleted)
  const questionCount = buildSteps(questionnaire.questions).length
  const isTypeform = displayMode === 'oneAtATime'

  // Frame the questions area with the form-style block's own outer styling so
  // the MC's background / padding / border / radius reaches couples, matching
  // the editor preview (BlockFrame applies the identical blockOuterStyle there).
  const frameStyle: CSSProperties | null =
    formBlock && hasOuterStyle(formBlock)
      ? blockOuterStyle(formBlock, { cornerRadius: questionnaire.corner_radius })
      : null
  // `flex` keeps the wrapper a definite-height flex column so the one-at-a-time
  // flow's `flex-1` root still resolves (a plain intermediate div reintroduces
  // the jumpy-nav bug — see the typeform branch below).
  const frameQuestions = (node: ReactNode, opts: { flex?: boolean } = {}) => {
    if (!frameStyle) return node
    const clip = frameStyle.borderRadius !== undefined || frameStyle.borderWidth
    return (
      <div
        style={frameStyle}
        className={`${opts.flex ? 'flex min-h-0 flex-1 flex-col' : ''} ${clip ? 'overflow-hidden' : ''}`.trim()}
      >
        {node}
      </div>
    )
  }

  // One-at-a-time welcome screen: shown before the first question.
  const [welcomeComplete, setWelcomeComplete] = useState(!showWelcome)

  const Renderer = isTypeform ? TypeformFlow : ClassicForm

  // Resolve button typography for consistent styling across the section.
  const buttonStyles = roleDefaults(questionnaire, 'body')

  // Per-block typography from the form-style block, resolved exactly as in the
  // editor preview (block override layered over the theme role). Passed as plain
  // CSS so the presentational renderers stay free of app-layer imports. Only set
  // when the MC actually overrode it, so unstyled questionnaires are untouched.
  const formStyleBlock =
    formBlock && (formBlock.type === 'questionnaireOneAtATime' || formBlock.type === 'questionnaireAllOnePage')
      ? formBlock
      : undefined
  const questionCss = formStyleBlock?.questionStyle
    ? resolveTextStyle(formStyleBlock.questionStyle, roleDefaults(questionnaire, 'sectionHeading'))
    : undefined
  const answerCss = formStyleBlock?.answerStyle
    ? resolveTextStyle(formStyleBlock.answerStyle, roleDefaults(questionnaire, 'body'))
    : undefined
  const formButtonColor = formStyleBlock?.buttonColor

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
    ...(questionCss ? { questionCss } : {}),
    ...(answerCss ? { answerCss } : {}),
    ...(formButtonColor ? { buttonColor: formButtonColor } : {}),
  }

  // One-at-a-time welcome screen (pre-blocks + Start button).
  if (isTypeform && showWelcome && !welcomeComplete) {
    const startBg = formButtonColor ?? theme.brand
    const startButtonBg = readableTextOn(startBg)
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
              backgroundColor: startBg,
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

        <h1 className="mb-1.5 font-semibold" style={{ fontSize: `${theme.docTitleFontSize}px`, color: theme.textColor, fontFamily: theme.headingStack }}>
          {questionnaire.title}
        </h1>
        <p className="mb-8" style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>
          {questionCount} question{questionCount === 1 ? '' : 's'} · your answers save as you go
        </p>

        {frameQuestions(<Renderer {...rendererProps} />)}

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
      <h1 className="mb-1.5 shrink-0 font-semibold" style={{ fontSize: `${theme.docTitleFontSize}px`, color: theme.textColor, fontFamily: theme.headingStack }}>
        {questionnaire.title}
      </h1>
      <p className="mb-8 shrink-0" style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>
        {questionCount} question{questionCount === 1 ? '' : 's'} · your answers save as you go
      </p>
      {/* The typeform flow's root carries `flex-1`, so any wrapper must itself
          be a definite-height flex column or the child's h-full collapses (the
          jumpy-nav bug). frameQuestions({ flex: true }) preserves that; with no
          form-block styling it returns the flow untouched. */}
      {frameQuestions(<Renderer {...rendererProps} />, { flex: true })}
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
