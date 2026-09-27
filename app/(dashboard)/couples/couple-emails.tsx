/**
 * Emails tab on the Couple Profile.
 *
 * Send a saved email template to this couple, send a test to your own
 * inbox, and see the sent-history below, all in one place (the manual
 * compose flow moved here off the Overview). Calm card list mirroring
 * the Automations tab; backed by `couple_emails`. Automated workflow
 * sends are logged there too (Task 30), with a delivery status the
 * Resend webhook keeps current; each row renders in `./couple-email-row`.
 *
 * @module app/(dashboard)/couples/couple-emails
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useState } from 'react'

import { ErrorState } from '@/components/ui/error-state'
import { createClient } from '@/lib/supabase/client'

import { CoupleEmailRow, emailOutcome, type CoupleEmail } from './couple-email-row'
import { CoupleSendEmail } from './couple-send-email'
import { CoupleTabEmpty, CoupleTabShell, type TabStat } from './couple-tab-shell'
import { CoupleTemplatePicker } from './couple-template-picker'

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
        // The step title rides along through the step_id foreign key: one
        // request, and null once the step (or its workflow) is deleted.
        .select(
          'id, subject, template_name, to_email, source, status, sent_at, transport, error, superseded_at, workflow_steps(title)',
        )
        .eq('couple_id', coupleId)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CoupleEmail[]
    },
  })

  // Separate buckets, so the success-toned figure only ever counts mail
  // that went out cleanly: a delayed send is still in doubt, and says so,
  // and a failure a later send replaced is history, counted in neither.
  const count = (outcome: ReturnType<typeof emailOutcome>) =>
    emails.filter((e) => emailOutcome(e) === outcome).length
  const undeliveredCount = count('undelivered')
  const delayedCount = count('delayed')
  const sentCount = count('sent')
  // The total is what the figures add up to, so it leaves replaced rows
  // out too; they still list below, labelled as replaced.
  const total = sentCount + delayedCount + undeliveredCount
  const stats: TabStat[] = [{ label: `${total} total` }]
  if (sentCount > 0) stats.push({ label: `${sentCount} sent`, tone: 'success' })
  if (delayedCount > 0) stats.push({ label: `${delayedCount} delayed` })
  if (undeliveredCount > 0) stats.push({ label: `${undeliveredCount} not delivered` })

  return (
    <CoupleTabShell
      title="Emails"
      stats={emails.length > 0 ? stats : undefined}
      actions={
        <>
          <CoupleTemplatePicker mode="test" onPick={(templateId) => setActive({ mode: 'test', templateId })} />
          <CoupleTemplatePicker mode="send" onPick={(templateId) => setActive({ mode: 'send', templateId })} />
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-control border border-border bg-card px-4 py-3.5">
              <div className="size-8 shrink-0 animate-pulse rounded-control bg-surface-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded-control bg-surface-muted" />
                <div className="h-3 w-56 max-w-full animate-pulse rounded-control bg-surface-muted" />
              </div>
              <div className="h-5 w-14 shrink-0 animate-pulse rounded-pill bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Couldn't load emails" onRetry={refetch} />
      ) : emails.length === 0 ? (
        <CoupleTabEmpty
          icon={Mail}
          title="No emails sent yet"
          description="Send this couple a template above. Sent templates and workflow emails show up here."
        />
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <CoupleEmailRow key={email.id} email={email} nowMs={nowMs} />
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
    </CoupleTabShell>
  )
}
