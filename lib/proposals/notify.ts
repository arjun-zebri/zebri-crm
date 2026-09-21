/**
 * MC-facing notifications for the close: email (Resend) plus a Slack alert.
 * Both are best-effort; callers fire-and-forget.
 *
 * @module lib/proposals/notify
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import { sendProposalAcceptedEmail, sendProposalDeclinedEmail } from '@/lib/email'
import { emailBrandingForUser } from '@/lib/email/branding'
import { resolveSender } from '@/lib/email/sender-identity'
import type { Database } from '@/types/database'

import { DECLINE_REASON_LABELS, type DeclineReason } from './close-types'

type Admin = SupabaseClient<Database>

/**
 * The proposal row plus the MC identity every notification needs. Null when
 * the proposal itself cannot be found, which should not happen for a caller
 * holding a real proposal id but is handled defensively since this runs
 * fire-and-forget with no one to report a crash to.
 *
 * Exported so `lib/proposals/notify-opened.ts` shares this one loader
 * instead of duplicating the select + auth lookup.
 *
 * @param admin - Service-role client (the caller already holds one).
 * @param proposalId - The proposal to load context for.
 */
export async function loadNotifyContext(admin: Admin, proposalId: string) {
  const { data } = await admin
    .from('proposals')
    .select(
      'id, user_id, proposal_number, title, declined_reason, declined_message, accepted_option_id, couple:couple_id(name), proposal_options!proposal_options_proposal_id_fkey(id, title)',
    )
    .eq('id', proposalId)
    .maybeSingle()
  if (!data) return null
  const { data: mc } = await admin.auth.admin.getUserById(data.user_id)
  const email = mc?.user?.email ?? null
  // Falls back to a name a human will still recognise: an MC's account
  // always has a business, but the metadata key predates a hard requirement.
  const businessName = (mc?.user?.user_metadata?.business_name as string | undefined) || 'Zebri'
  const couple = Array.isArray(data.couple) ? data.couple[0] : data.couple
  return { row: data, email, businessName, coupleName: couple?.name ?? 'The couple' }
}

/** Link to the proposal's page in the dashboard, for the "Open in Zebri" CTA. */
const detailUrl = (id: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/proposals/${id}`

/**
 * Notify the MC that a couple accepted a proposal option: email plus a
 * Slack alert. Called once, from `finalizeProposalAcceptance`, the moment a
 * signed contract turns into a booking.
 *
 * @param admin - Service-role client (the caller already holds one).
 * @param proposalId - The proposal that was accepted.
 * @param total - The accepted option's total, in dollars.
 * @param invoiceNumber - The invoice `finalize_proposal_acceptance` generated, named in the email.
 */
export async function notifyProposalAccepted(admin: Admin, proposalId: string, total: number, invoiceNumber: string): Promise<void> {
  const ctx = await loadNotifyContext(admin, proposalId)
  if (!ctx) return
  const options = Array.isArray(ctx.row.proposal_options) ? ctx.row.proposal_options : []
  const packageName = options.find((o) => o.id === ctx.row.accepted_option_id)?.title ?? 'Package'

  if (ctx.email) {
    const [branding, sender] = await Promise.all([
      emailBrandingForUser(admin, ctx.row.user_id),
      resolveSender(admin, ctx.row.user_id, ctx.businessName),
    ])
    await sendProposalAcceptedEmail({
      to: ctx.email,
      coupleName: ctx.coupleName,
      proposalNumber: ctx.row.proposal_number,
      proposalTitle: ctx.row.title,
      packageName,
      total,
      invoiceNumber,
      detailUrl: detailUrl(proposalId),
      mcBusinessName: ctx.businessName,
      branding,
      sender,
    })
  }

  await sendAlert({
    type: 'proposal_accepted',
    severity: 'info',
    userId: ctx.row.user_id,
    proposalNumber: ctx.row.proposal_number,
    coupleName: ctx.coupleName,
    total,
  })
}

/**
 * Notify the MC that a couple declined a proposal: email plus a Slack
 * alert. Called from the decline route the moment `decline_proposal`
 * records the reason.
 *
 * @param admin - Service-role client (the caller already holds one).
 * @param proposalId - The proposal that was declined.
 */
export async function notifyProposalDeclined(admin: Admin, proposalId: string): Promise<void> {
  const ctx = await loadNotifyContext(admin, proposalId)
  if (!ctx) return
  const reason = (ctx.row.declined_reason as DeclineReason | null) ?? 'other'

  if (ctx.email) {
    const [branding, sender] = await Promise.all([
      emailBrandingForUser(admin, ctx.row.user_id),
      resolveSender(admin, ctx.row.user_id, ctx.businessName),
    ])
    await sendProposalDeclinedEmail({
      to: ctx.email,
      coupleName: ctx.coupleName,
      proposalNumber: ctx.row.proposal_number,
      proposalTitle: ctx.row.title,
      reasonLabel: DECLINE_REASON_LABELS[reason],
      message: ctx.row.declined_message,
      detailUrl: detailUrl(proposalId),
      mcBusinessName: ctx.businessName,
      branding,
      sender,
    })
  }

  await sendAlert({
    type: 'proposal_declined',
    severity: 'info',
    userId: ctx.row.user_id,
    proposalNumber: ctx.row.proposal_number,
    coupleName: ctx.coupleName,
    reason,
  })
}
