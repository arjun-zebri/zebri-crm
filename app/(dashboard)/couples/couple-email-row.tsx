/**
 * One logged email on the couple's Emails tab, and what its status means.
 *
 * Manual sends log `sent` and stay there. Automated sends (Task 30) log
 * `sent` or `failed`. A `sent` row through the shared Zebri address is
 * then moved on by the Resend webhook to delivered, delayed, bounced or
 * complained, so its pill is the answer to "did it arrive". A send from
 * the MC's own Gmail or Outlook never hears back (those transports raise
 * no delivery events), so it reads as final and untracked rather than
 * awaiting word forever. A failure says why, and one a later send
 * replaced says so rather than "not delivered" (Phase 5 fix wave, I2, M4).
 *
 * @module app/(dashboard)/couples/couple-email-row
 */
'use client'

import { Mail, Workflow } from 'lucide-react'

import { StatePill, type StatePillDot, type StatePillTone } from '@/components/ui/state-pill'
import { formatRelativeTime } from '@/lib/utils'

/** One logged send, as the Emails tab reads it. */
export interface CoupleEmail {
  id: string
  subject: string
  template_name: string | null
  to_email: string
  source: string
  status: string
  sent_at: string
  /** `resend`, `gmail` or `graph` on automated rows; null on manual ones. */
  transport: string | null
  /** Why a failed send failed, as the transport worded it. */
  error: string | null
  /** Set on a failed row a later send for the same step and address replaced. */
  superseded_at: string | null
  /** The workflow step that sent it (automated rows), when it still exists. */
  workflow_steps: { title: string | null } | null
}

/** A pill: its words, colour and dot. */
interface Pill {
  label: string
  tone: StatePillTone
  dot: StatePillDot
}

/** How each `couple_emails.status` reads on the pill. */
const STATUS_PILL: Record<string, Pill> = {
  // Out of our hands, no word back yet: the "awaiting" shape the
  // primitive documents for Sent.
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  deferred: { label: 'Delayed', tone: 'warning', dot: 'hollow' },
  delivered: { label: 'Delivered', tone: 'success', dot: 'filled' },
  bounced: { label: 'Bounced', tone: 'danger', dot: 'filled' },
  complained: { label: 'Complained', tone: 'danger', dot: 'filled' },
  failed: { label: 'Failed', tone: 'danger', dot: 'filled' },
}

/**
 * A send from the MC's own mailbox: final, not awaiting. Neutral rather
 * than success because nobody confirmed delivery; filled because no
 * further word is coming.
 */
const MAILBOX_PILL: Pill = { label: 'Sent from your mailbox', tone: 'neutral', dot: 'filled' }

/** A failure a later send replaced: history, not a problem. */
const REPLACED_PILL: Pill = { label: 'Replaced by a later send', tone: 'neutral', dot: false }

/** Statuses that mean the email did not (or may not) reach the inbox. */
export const UNDELIVERED_STATUSES: ReadonlySet<string> = new Set(['failed', 'bounced', 'complained'])

/** Transports that never report delivery (the MC's own mailbox). */
const UNTRACKED_TRANSPORTS: ReadonlySet<string> = new Set(['gmail', 'graph'])

/** The pill for a status, falling back to a neutral one for anything unknown. */
export function statusPill(status: string): Pill {
  return STATUS_PILL[status] ?? { label: status, tone: 'neutral', dot: false }
}

/** Where one row counts on the tab's header figures. */
export type EmailOutcome = 'sent' | 'delayed' | 'undelivered' | 'replaced'

/** Where `email` counts: a replaced failure is neither sent nor undelivered. */
export function emailOutcome(email: Pick<CoupleEmail, 'status' | 'superseded_at'>): EmailOutcome {
  if (email.status === 'failed' && email.superseded_at) return 'replaced'
  if (UNDELIVERED_STATUSES.has(email.status)) return 'undelivered'
  if (email.status === 'deferred') return 'delayed'
  return 'sent'
}

/** The pill one row shows, reading its transport and supersession too. */
export function emailPill(email: Pick<CoupleEmail, 'status' | 'transport' | 'superseded_at'>): Pill {
  if (emailOutcome(email) === 'replaced') return REPLACED_PILL
  if (email.status === 'sent' && email.transport && UNTRACKED_TRANSPORTS.has(email.transport)) return MAILBOX_PILL
  return statusPill(email.status)
}

/** The muted line under a row, if it has one: why it failed, or that it is untracked. */
function detailLine(email: CoupleEmail): string | null {
  const pill = emailPill(email)
  if (pill === MAILBOX_PILL) return "Delivery isn't tracked for your own mailbox."
  if (pill !== REPLACED_PILL && email.status === 'failed' && email.error) return `Not sent: ${email.error}`
  return null
}

interface CoupleEmailRowProps {
  email: CoupleEmail
  /** Render-stable "now" for the relative time. */
  nowMs: number
}

/** A calm card for one logged email: what, to whom, how it went, when. */
export function CoupleEmailRow({ email, nowMs }: CoupleEmailRowProps) {
  const automated = email.source === 'automation'
  const pill = emailPill(email)
  const detail = detailLine(email)
  const stepTitle = email.workflow_steps?.title?.trim() || null
  // Lead with the template name (falling back to the subject for inline
  // and automated sends). The line underneath says where it came from
  // and who it went to.
  const context = automated
    ? `Workflow${stepTitle ? `: ${stepTitle}` : ''} · `
    : email.template_name
      ? `${email.subject} · `
      : ''
  const Icon = automated ? Workflow : Mail

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-card px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted">
        <Icon size={15} strokeWidth={1.5} className="text-text-subtle" />
      </span>
      {/* Below sm the status sits under the text rather than beside it:
          beside it, a long pill squeezed the subject to a few characters
          on a phone (Phase 5 residual pass, R1). */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-text">{email.template_name ?? email.subject}</p>
          <p className="mt-0.5 truncate text-body text-text-muted">
            {context}to {email.to_email}
          </p>
          {/* Wraps in full: a hover title never shows on touch, and the
              reason is the point of the line. */}
          {detail ? <p className="mt-0.5 break-words text-body text-text-subtle">{detail}</p> : null}
        </div>
        <div
          data-slot="email-row-status"
          className="flex flex-row flex-wrap items-center gap-2 sm:shrink-0 sm:flex-col sm:flex-nowrap sm:items-end sm:gap-1"
        >
          <StatePill tone={pill.tone} label={pill.label} dot={pill.dot} />
          <span className="text-body text-text-subtle">{formatRelativeTime(email.sent_at, nowMs) || '—'}</span>
        </div>
      </div>
    </div>
  )
}
