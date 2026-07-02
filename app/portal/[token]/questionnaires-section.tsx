'use client'

import { Check, ExternalLink } from 'lucide-react'

import type { PortalQuestionnaire } from './page'

interface QuestionnairesSectionProps {
  questionnaires: PortalQuestionnaire[]
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success'
    case 'sent':
      return 'bg-info/10 text-info'
    default:
      return 'bg-surface-muted text-text-muted'
  }
}

/**
 * Questionnaires section: lists the questionnaires the MC has sent, each
 * linking out to the standalone fill-in page (`/questionnaire/[token]`).
 * Completed ones show a success tint; the rest invite the couple to start.
 */
export function QuestionnairesSection({ questionnaires }: QuestionnairesSectionProps) {
  if (questionnaires.length === 0) {
    return (
      <div className="border border-border rounded-card p-6 text-center">
        <p className="text-body text-text-muted">No questionnaires yet. Your MC will send them here.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {questionnaires.map((q) => {
        const isDone = q.status === 'completed'
        return (
          <div
            key={q.id}
            className={`flex flex-col rounded-card border p-4 ${
              isDone ? 'border-success/30 bg-success/5' : 'border-border bg-surface hover:border-border-strong'
            }`}
          >
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-body font-medium text-text">{q.title}</p>
              <span className={`flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium capitalize ${statusColor(q.status)}`}>
                {isDone && <Check size={13} strokeWidth={1.5} />}
                {q.status}
              </span>
            </div>

            {q.share_token_enabled && q.share_token ? (
              <a
                href={`/questionnaire/${q.share_token}`}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-control px-3 py-2 text-caption font-medium transition cursor-pointer sm:w-auto ${
                  isDone ? 'text-brand-fg hover:text-text-muted' : 'bg-brand-fg text-text-inverse hover:opacity-90'
                }`}
              >
                {isDone ? 'View answers' : 'Fill it in'} <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            ) : (
              <p className="px-3 py-2 text-center text-caption text-text-subtle">Not yet shared</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
