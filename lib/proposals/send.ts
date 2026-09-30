/**
 * Sending a proposal to its couple, shared by the manual route
 * (`/api/email/send-proposal`) and the `send_proposal` workflow action
 * (roadmap R2, spec 5.4, decision L8).
 *
 * Sending means three things, in this order: the share link becomes
 * resolvable (and a draft becomes `sent`), the email goes out, and the
 * send is stamped and logged. The first flip is what makes
 * `tg_proposals_emit_lifecycle` emit `proposal_sent`, so neither caller
 * touches the bus.
 *
 * Guards are a separate pure function so each caller can phrase the
 * refusal its own way: the route as an HTTP status and copy, the action
 * as a skip reason in the run log.
 *
 * @module lib/proposals/send
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/alerts/logger'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { sendProposalEmail } from '@/lib/email'
import type { ResolvedSender } from '@/lib/email/sender-identity'
import type { Database } from '@/types/database'

/** The columns a send reads; both callers select exactly these. */
export interface SendableProposal {
  id: string
  couple_id: string
  proposal_number: string
  title: string
  share_token: string
  share_token_enabled: boolean
  status: string
  expires_at: string | null
  contract_template_id: string | null
  /**
   * When the email last left, or null if it never did. Stamped only after
   * Resend accepts the send, so a `sent` row with a null here is a link
   * that went live whose email never left (a transient failure between
   * the status flip and the send).
   */
  email_sent_at: string | null
}

/** Why a proposal cannot be sent right now. */
export type ProposalSendBlock = 'accepted' | 'no_contract_template' | 'no_primary_email'

/** Couple-facing copy per block, for the route's error responses. */
export const PROPOSAL_SEND_BLOCK_COPY: Record<ProposalSendBlock, string> = {
  accepted: 'This proposal has already been accepted.',
  no_contract_template: 'Choose a contract template before sending.',
  no_primary_email: 'No email on file for this couple. Add one in their profile.',
}

/**
 * The first reason a send must not happen, or null when it may.
 *
 * Accepted first: it is the one state no edit can fix. Then the contract
 * template, because accepting needs one. Then the email, which is the
 * couple's problem rather than the proposal's.
 */
export function proposalSendBlock(
  proposal: Pick<SendableProposal, 'status' | 'contract_template_id'>,
  coupleEmail: string | null,
): ProposalSendBlock | null {
  if (proposal.status === 'accepted') return 'accepted'
  if (!proposal.contract_template_id) return 'no_contract_template'
  if (!coupleEmail) return 'no_primary_email'
  return null
}

/** Everything a send needs, including the proposal row. */
export interface ProposalSendInput {
  proposal: SendableProposal
  userId: string
  coupleEmail: string
  coupleName: string
  mcBusinessName: string
  sender: ResolvedSender
  branding: PublicBranding | null
  /** Logged on `couple_emails.source`, so the Emails tab can tell them apart. */
  source: 'manual' | 'automation'
}

/** Outcome of a send: the share URL, or which stage failed and why. */
export type ProposalSendResult =
  | { ok: true; shareUrl: string }
  | { ok: false; stage: 'enable_link' | 'send'; error: string }

/** `expires_at` as the email prints it, e.g. "15 January 2027". */
function formatExpiry(date: string | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Send `input.proposal` to the couple. The caller has already passed
 * {@link proposalSendBlock}; this function does not re-check.
 *
 * `supabase` is the caller's client: the route's user-scoped one (RLS
 * applies) or the action's admin one (a cron run has no session).
 */
export async function sendProposalToCouple(
  supabase: SupabaseClient<Database>,
  input: ProposalSendInput,
): Promise<ProposalSendResult> {
  const { proposal } = input

  // Sending implicitly says "the couple may view this" and "this is no
  // longer a draft". The two flips are independent: share_token_enabled
  // defaults to false so an unsent draft's link is dead, and a proposal
  // reverted to draft has the flag cleared while keeping its token.
  const updates: Database['public']['Tables']['proposals']['Update'] = {}
  if (!proposal.share_token_enabled) updates.share_token_enabled = true
  if (proposal.status === 'draft') updates.status = 'sent'
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('proposals').update(updates).eq('id', proposal.id)
    if (error) return { ok: false, stage: 'enable_link', error: error.message }
  }

  // Read per call so the URL follows the environment, as the route always did.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'
  const shareUrl = `${appUrl}/proposal/${proposal.share_token}`
  const result = await sendProposalEmail({
    coupleEmail: input.coupleEmail,
    coupleName: input.coupleName,
    proposalNumber: proposal.proposal_number,
    proposalTitle: proposal.title,
    expiresAt: formatExpiry(proposal.expires_at),
    shareUrl,
    mcBusinessName: input.mcBusinessName,
    sender: input.sender,
    branding: input.branding,
  })
  if (!result.ok) {
    logger.error('[proposals/send] resend failed', {
      userId: input.userId,
      proposalId: proposal.id,
      error: result.error,
    })
    return { ok: false, stage: 'send', error: result.error || 'Failed to send email' }
  }

  await supabase
    .from('proposals')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', proposal.id)

  // Best effort: a log failure must not fail an email that already went out.
  const { error: logErr } = await supabase.from('couple_emails').insert({
    user_id: input.userId,
    couple_id: proposal.couple_id,
    template_id: null,
    template_name: 'Proposal',
    subject: `A proposal from ${input.mcBusinessName} - ${proposal.proposal_number}`,
    to_email: input.coupleEmail,
    source: input.source,
    status: 'sent',
  })
  if (logErr) {
    logger.error('[proposals/send] couple_emails log failed', {
      userId: input.userId,
      proposalId: proposal.id,
      error: logErr.message,
    })
  }

  return { ok: true, shareUrl }
}
