/**
 * One questionnaire row on the couple profile's Questionnaires tab: status
 * pill with lifecycle detail (draft → sent → opened → in progress →
 * completed), and the row actions the MC reaches for when a couple goes
 * quiet — copy the share link, resend the email, or turn the link off/on.
 *
 * @module app/(dashboard)/couples/couple-questionnaire-row
 */
'use client'

import { ClipboardList, Link2, Link2Off, Send } from 'lucide-react'

import { RowActionsMenu, type RowAction } from '@/components/ui/row-actions-menu'
import { StatePill, type StatePillDot, type StatePillTone } from '@/components/ui/state-pill'

import type { CoupleQuestionnaire } from './couple-questionnaires'

interface RowProps {
  questionnaire: CoupleQuestionnaire
  onOpen: () => void
  onCopyLink: () => void
  onResend: () => void
  onToggleLink: () => void
}

function fmt(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Lifecycle presentation: pill label/tone/dot plus the subtitle line. */
function lifecycle(q: CoupleQuestionnaire): { label: string; tone: StatePillTone; dot: StatePillDot; detail: string } {
  if (q.status === 'completed') {
    return { label: 'completed', tone: 'success', dot: 'filled', detail: `Completed ${fmt(q.completed_at)}` }
  }
  if (q.status === 'sent') {
    const started = Object.keys(q.responses ?? {}).length > 0
    if (started) return { label: 'in progress', tone: 'info', dot: 'hollow', detail: `Started · sent ${fmt(q.sent_at)}` }
    if (q.viewed_at) return { label: 'opened', tone: 'info', dot: 'hollow', detail: `Opened ${fmt(q.viewed_at)}` }
    return { label: 'sent', tone: 'info', dot: 'hollow', detail: `Sent ${fmt(q.sent_at)}` }
  }
  return { label: 'draft', tone: 'neutral', dot: false, detail: 'Draft' }
}

export function CoupleQuestionnaireRow({ questionnaire: q, onOpen, onCopyLink, onResend, onToggleLink }: RowProps) {
  const state = lifecycle(q)
  const linkOff = !q.share_token_enabled

  const actions: RowAction[] = [
    { label: 'Copy link', icon: <Link2 size={15} strokeWidth={1.5} />, onSelect: onCopyLink },
    ...(q.status !== 'completed'
      ? [{ label: 'Resend email', icon: <Send size={15} strokeWidth={1.5} />, onSelect: onResend }]
      : []),
    {
      label: linkOff ? 'Turn link on' : 'Turn link off',
      icon: linkOff ? <Link2 size={15} strokeWidth={1.5} /> : <Link2Off size={15} strokeWidth={1.5} />,
      onSelect: onToggleLink,
    },
  ]

  return (
    <div className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-muted">
      <button onClick={onOpen} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
        <ClipboardList size={15} strokeWidth={1.5} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{q.title}</span>
          <span className="block text-xs text-text-subtle">
            {state.detail}
            {linkOff && ' · link off'}
          </span>
        </span>
      </button>
      <StatePill label={state.label} tone={state.tone} dot={state.dot} />
      <RowActionsMenu alwaysVisible actions={actions} />
    </div>
  )
}
