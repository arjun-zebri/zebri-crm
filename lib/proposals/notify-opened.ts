/**
 * First-open notification for the MC: email + Slack, best-effort. Called by
 * the events route when `record_proposal_events` reports `first_open`.
 *
 * @module lib/proposals/notify-opened
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import { sendProposalOpenedEmail } from '@/lib/email'
import { emailBrandingForUser } from '@/lib/email/branding'
import { resolveSender } from '@/lib/email/sender-identity'
import type { Database } from '@/types/database'

import { loadNotifyContext } from './notify'

/**
 * Email + Slack the MC that the couple opened the proposal for the first
 * time. Best-effort and silent on failure (mirrors `notifyProposalAccepted`
 * / `notifyProposalDeclined`): this runs fire-and-forget from the events
 * route, with no request left open to report a failure back to.
 *
 * @param admin - Service-role client (the caller already holds one).
 * @param proposalId - The proposal that was opened.
 */
export async function notifyProposalOpened(admin: SupabaseClient<Database>, proposalId: string): Promise<void> {
  const ctx = await loadNotifyContext(admin, proposalId)
  if (!ctx) return
  if (ctx.email) {
    const [branding, sender] = await Promise.all([
      emailBrandingForUser(admin, ctx.row.user_id),
      resolveSender(admin, ctx.row.user_id, ctx.businessName),
    ])
    await sendProposalOpenedEmail({
      to: ctx.email,
      coupleName: ctx.coupleName,
      proposalNumber: ctx.row.proposal_number,
      proposalTitle: ctx.row.title,
      detailUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/proposals/${proposalId}`,
      mcBusinessName: ctx.businessName,
      branding,
      sender,
    })
  }
  await sendAlert({ type: 'proposal_opened', severity: 'info', userId: ctx.row.user_id, proposalNumber: ctx.row.proposal_number, coupleName: ctx.coupleName })
}
