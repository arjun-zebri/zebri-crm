'use client'

/**
 * "Send to couple", the proposal editor's one header action beyond the
 * shared editing controls (roadmap R3 §6.1). It POSTs to
 * `/api/email/send-proposal`, the same route the v1 builder's Send
 * mutation calls (`components/builders/parts/use-proposal-form.ts`): that
 * route enables the share token, flips draft to sent, emails the link and
 * logs the send on the couple's Emails tab, so there is nothing for the
 * editor to do beyond firing it and reporting the outcome.
 *
 * The label follows `share-and-send.tsx`: "Send to couple" the first time,
 * "Resend" once the proposal has been sent. The editor learns that from
 * the loaded `status` (the route is what moves a proposal off `draft`) and
 * from its own successful send, so the label flips without a refetch.
 *
 * There is no busy label swap: `<Button loading>` overlays the spinner on
 * the label, so the control never changes size mid-click.
 *
 * @module features/proposals/editor/send-to-couple-button
 */
import { Send } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

/** Props for {@link SendToCoupleButton}. */
export interface SendToCoupleButtonProps {
  /**
   * The proposal to send, resolved when the button is pressed rather than
   * passed in: on the "make edits" route the row does not exist until
   * something asks for it, and choosing to send is exactly such an ask.
   * Idempotent, so pressing Send twice cannot make two proposals.
   */
  resolveProposalId: () => Promise<string>
  /** The proposal's status as loaded. Anything past `draft` has been sent, so the button offers a resend. */
  status: string
  /** Called after a send lands, so the gate can refresh the row (the status and the send stamp both moved). */
  onSent?: () => void
}

/** Sends (or resends) the proposal email to the couple. */
export function SendToCoupleButton({ resolveProposalId, status, onSent }: SendToCoupleButtonProps) {
  const { toast } = useToast()
  const [sending, setSending] = useState(false)
  // Sticky for the session: the loaded `status` is a snapshot, and after a
  // successful send the label has to read "Resend" whether or not the row
  // has been refetched yet.
  const [justSent, setJustSent] = useState(false)
  const alreadySent = justSent || status !== 'draft'

  const send = useCallback(async () => {
    setSending(true)
    try {
      const proposalId = await resolveProposalId()
      const res = await fetch('/api/email/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      })
      if (!res.ok) {
        // The route's own message is the useful one ("Choose a contract
        // template before sending", "No email on file for this couple"),
        // so it is surfaced as-is rather than replaced with a generic.
        const body: unknown = await res.json().catch(() => ({}))
        const error = typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : null
        throw new Error(error ?? 'Failed to send')
      }
      setJustSent(true)
      toast('Proposal sent to the couple')
      onSent?.()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send', 'error')
    } finally {
      setSending(false)
    }
  }, [resolveProposalId, toast, onSent])

  return (
    <Button onClick={() => void send()} loading={sending} className="shrink-0 gap-1.5">
      <Send size={14} strokeWidth={1.5} />
      {alreadySent ? 'Resend' : 'Send to couple'}
    </Button>
  )
}
