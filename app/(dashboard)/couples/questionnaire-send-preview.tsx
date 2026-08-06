/**
 * Pre-send preview for a questionnaire, shown in the couple-profile send flow.
 *
 * Two tabs: the questionnaire exactly as the couple will experience it (the
 * shared {@link QuestionnaireExperiencePreview}, with a desktop / phone width
 * toggle), and the cover email that delivers the link (the real
 * {@link questionnaireHtml} output in a sandboxed iframe). The MC confirms
 * what's going out before sending, mirroring the quote/invoice/contract flow.
 *
 * @module app/(dashboard)/couples/questionnaire-send-preview
 */
'use client'

import { Mail, Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'

import { QuestionnaireExperiencePreview } from '@/components/questionnaires/experience-preview'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'
import { questionnaireHtml } from '@/lib/email/html'
import type { Question, QuestionnaireDisplayMode } from '@/lib/questionnaires/question-schema'

interface Props {
  name: string
  questions: Question[]
  displayMode: QuestionnaireDisplayMode
  coupleName: string
}

type Tab = 'questionnaire' | 'email'

export function QuestionnaireSendPreview({ name, questions, displayMode, coupleName }: Props) {
  const { branding } = useCurrentBranding('questionnaire')
  const [tab, setTab] = useState<Tab>('questionnaire')
  const [frame, setFrame] = useState<'desktop' | 'mobile'>('desktop')

  const emailHtml = questionnaireHtml({
    coupleName: coupleName || 'there',
    title: name,
    // The real link only exists once the questionnaire is created on send.
    shareUrl: 'https://…/questionnaire/…',
    mcBusinessName: branding?.business_name || 'Your celebrant',
  })

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`cursor-pointer rounded-control px-3 py-1.5 text-sm font-medium transition-colors ${
        tab === value ? 'bg-surface-muted text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  )

  return (
    // Viewport-relative preview height: large enough to read comfortably,
    // small enough that the whole modal (header + tabs + footer) fits on
    // screen without clipping the wizard's nav.
    <div className="flex flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {tabButton('questionnaire', 'Questionnaire')}
          {tabButton('email', 'Email')}
        </div>
        {tab === 'questionnaire' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Desktop preview"
              onClick={() => setFrame('desktop')}
              className={`cursor-pointer rounded-control p-1.5 transition-colors ${frame === 'desktop' ? 'bg-surface-muted text-text' : 'text-text-muted hover:text-text'}`}
            >
              <Monitor size={15} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Phone preview"
              onClick={() => setFrame('mobile')}
              className={`cursor-pointer rounded-control p-1.5 transition-colors ${frame === 'mobile' ? 'bg-surface-muted text-text' : 'text-text-muted hover:text-text'}`}
            >
              <Smartphone size={15} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Both panels stay mounted; the inactive one is CSS-hidden. Remounting
          the questionnaire panel on every tab switch would refetch branding
          and flash the default palette (and reset the wizard position). */}
      <div className={tab === 'questionnaire' ? '' : 'hidden'}>
        <QuestionnaireExperiencePreview title={name} questions={questions} displayMode={displayMode} frame={frame} heightClass="h-[58vh]" />
      </div>
      <div className={`h-[58vh] flex-col overflow-hidden rounded-control border border-border ${tab === 'email' ? 'flex' : 'hidden'}`}>
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-muted px-4 py-2.5 text-sm text-text-muted">
          <Mail size={14} strokeWidth={1.5} />
          <span className="truncate">
            Subject: {branding?.business_name || 'Your celebrant'} sent you a few questions
          </span>
        </div>
        {/* Sandboxed: the email HTML is trusted output of questionnaireHtml,
            but the iframe keeps its styles from leaking either way. */}
        <iframe title="Email preview" sandbox="" srcDoc={emailHtml} className="min-h-0 w-full flex-1 bg-white" />
      </div>
    </div>
  )
}
