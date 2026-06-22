/**
 * Emails tab on the Couple Profile.
 *
 * Send a saved email template to this couple, send a test to your own
 * inbox, and see the sent-history below — all in one place (the manual
 * compose flow moved here off the Overview). Calm card list mirroring
 * the Automations tab; backed by `couple_emails`.
 *
 * @module app/(dashboard)/couples/couple-emails
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useState } from 'react'

import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { StatePill, type StatePillTone } from '@/components/ui/state-pill'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

import { CoupleSendEmail } from './couple-send-email'
import { CoupleTemplatePicker } from './couple-template-picker'

/** One logged send. */
interface CoupleEmail {
  id: string
  subject: string
  template_name: string | null
  to_email: string
  source: string
  status: string
  sent_at: string
}

const STATUS_TONE: Record<string, StatePillTone> = {
  sent: 'success',
  failed: 'danger',
}

interface CoupleEmailsProps {
  coupleId: string
  coupleName: string
}

export function CoupleEmails({ coupleId, coupleName }: CoupleEmailsProps) {
  const [nowMs] = useState(() => Date.now())
  // A picked template opens the compose modal pre-selected, in send/test mode.
  const [active, setActive] = useState<{ mode: 'send' | 'test'; templateId: string } | null>(null)

  const { data: emails = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['couple-emails', coupleId],
    queryFn: async (): Promise<CoupleEmail[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('couple_emails')
        .select('id, subject, template_name, to_email, source, status, sent_at')
        .eq('couple_id', coupleId)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CoupleEmail[]
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <CoupleTemplatePicker mode="test" onPick={(templateId) => setActive({ mode: 'test', templateId })} />
        <CoupleTemplatePicker mode="send" onPick={(templateId) => setActive({ mode: 'send', templateId })} />
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="size-8 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded-md bg-surface-muted" />
                <div className="h-3 w-56 max-w-full animate-pulse rounded-md bg-surface-muted" />
              </div>
              <div className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Couldn't load emails" onRetry={refetch} />
      ) : emails.length === 0 ? (
        <Empty
          size="sm"
          className="min-h-[36vh]"
          icon={Mail}
          title="No emails sent yet"
          description="Send this couple a template above. Sent templates will show up here."
        />
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <div key={email.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                <Mail size={15} strokeWidth={1.5} className="text-text-subtle" />
              </span>
              <div className="min-w-0 flex-1">
                {/* Lead with the template name (falling back to the subject for
                    inline sends); the subject sits underneath. */}
                <p className="truncate text-sm font-medium text-text">{email.template_name ?? email.subject}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {email.template_name ? `${email.subject} · ` : ''}to {email.to_email}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatePill
                  tone={STATUS_TONE[email.status] ?? 'neutral'}
                  label={email.status === 'sent' ? 'Sent' : email.status}
                  dot="filled"
                />
                <span className="text-xs text-text-subtle">{formatRelativeTime(email.sent_at, nowMs) || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <CoupleSendEmail
          isOpen
          mode={active.mode}
          initialTemplateId={active.templateId}
          onClose={() => setActive(null)}
          onSent={() => refetch()}
          coupleId={coupleId}
          coupleName={coupleName}
        />
      )}
    </div>
  )
}
