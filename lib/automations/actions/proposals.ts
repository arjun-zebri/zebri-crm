/**
 * Proposal actions (roadmap R2, spec 5.4).
 *
 * send_proposal  emails the couple their most recent draft proposal,
 *                enabling its share link. Draft only (decision L8): a
 *                resend nudge is a "Send email" step with
 *                `{{proposal.link}}`, so this step never re-mails a
 *                proposal the couple already has. The one non-draft it
 *                will send is a `sent` row whose `email_sent_at` is
 *                still null: the link went live but the email never
 *                left, so the couple does not have it yet and a retry
 *                of the errored step must be able to finish the send.
 *
 * @module lib/automations/actions/proposals
 */

import { z } from 'zod'

import { resolveSender } from '@/lib/email/sender-identity'
import {
  proposalSendBlock,
  sendProposalToCouple,
  type ProposalSendBlock,
  type SendableProposal,
} from '@/lib/proposals/send'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionType, RunContext } from '@/types/automations'

import type { ActionSpec } from './index'

const COLUMNS =
  'id, couple_id, proposal_number, title, share_token, share_token_enabled, status, expires_at, contract_template_id, email_sent_at'

/** Only the id that overrides the pick; there is nothing else to configure. */
const sendProposalSchema = z.object({ proposalId: z.string().uuid().optional() }).passthrough()

/** Run-log phrasing per block. */
const SKIP_REASON: Record<ProposalSendBlock, string> = {
  accepted: 'no draft proposal',
  no_contract_template: 'no contract template',
  no_primary_email: 'no primary email',
}

/**
 * Resolve the proposal to send: explicit id → the triggering proposal →
 * a proposal a prior step produced (R3's create_proposal, decision L10)
 * → the couple's most recent sendable row (a draft, or a `sent` row that
 * was never emailed; see {@link isSendable}).
 */
async function pickProposal(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
): Promise<SendableProposal | null> {
  if (explicitId) {
    const { data } = await supabase
      .from('proposals')
      .select(COLUMNS)
      .eq('id', explicitId)
      .eq('user_id', ctx.userId)
      .single()
    return (data as SendableProposal | null) ?? null
  }
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  if (typeof payload['proposal_id'] === 'string') return pickProposal(supabase, ctx, payload['proposal_id'])
  for (const actionId of Object.keys(ctx.actionResults)) {
    const r = ctx.actionResults[actionId] as Record<string, unknown> | null
    if (typeof r?.['proposal_id'] === 'string') return pickProposal(supabase, ctx, r['proposal_id'])
  }
  if (!ctx.couple) return null
  // The latest sendable row, not the latest draft: a retry after a
  // transient email failure reaches this same fallback (nothing in the
  // trigger payload or a prior step names the proposal), and by then the
  // row is `sent` with no `email_sent_at`. Excluding it here would turn
  // every such retry into a "no draft proposal" skip.
  const { data } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.userId)
    .or('status.eq.draft,and(status.eq.sent,email_sent_at.is.null)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as SendableProposal | null) ?? null
}

/**
 * Whether this step may send `proposal`: a draft, or a `sent` row whose
 * email never left. L8 ("never re-mail a proposal the couple already
 * has") holds because `email_sent_at` is the proof they have it; it is
 * stamped only after Resend accepts the send, so a null stamp on a
 * `sent` row means the status flip landed and the email did not.
 */
function isSendable(proposal: SendableProposal): boolean {
  if (proposal.status === 'draft') return true
  return proposal.status === 'sent' && proposal.email_sent_at === null
}

const sendProposal: ActionSpec<z.infer<typeof sendProposalSchema>> = {
  type: 'send_proposal',
  configSchema: sendProposalSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const proposal = await pickProposal(supabase, ctx, config.proposalId)
    // A picked proposal the couple already has (emailed, viewed, accepted,
    // declined, expired) is the same skip as no proposal at all: L8 says
    // this step sends drafts and nothing else, bar the unmailed `sent`
    // row {@link isSendable} lets through so an errored send can retry.
    if (!proposal || !isSendable(proposal)) {
      return { kind: 'ok', output: { skipped: 'no draft proposal' } }
    }
    // An explicit id is only scoped by tenant, not by couple: without this
    // check a misconfigured step could email another couple's proposal to
    // this couple's address and log the send against this couple. Same
    // skip reason as "no draft proposal", since from this couple's run
    // log there is none.
    if (proposal.couple_id !== ctx.couple?.id) {
      return { kind: 'ok', output: { skipped: 'no draft proposal' } }
    }
    const coupleEmail = ctx.couple?.email ?? null
    const block = proposalSendBlock(proposal, coupleEmail)
    if (block) return { kind: 'ok', output: { skipped: SKIP_REASON[block] } }

    const result = await sendProposalToCouple(supabase, {
      proposal,
      userId: ctx.userId,
      coupleEmail: coupleEmail!,
      coupleName: ctx.couple?.name ?? 'there',
      mcBusinessName: ctx.mc.businessName,
      sender: await resolveSender(supabase, ctx.userId, ctx.mc.businessName),
      branding: ctx.mc.branding ?? null,
      source: 'automation',
    })
    if (!result.ok) return { kind: 'error', message: result.error, recoverable: true }

    return {
      kind: 'ok',
      output: {
        proposal_id: proposal.id,
        proposal_link: result.shareUrl,
        proposal_number: proposal.proposal_number,
        proposal_title: proposal.title,
      },
    }
  },
  ui: {
    category: 'payments',
    label: 'Send proposal',
    description: 'Email the couple their draft proposal',
    icon: 'FileText',
  },
}

/**
 * The proposal action specs, keyed by {@link ActionType}, merged into the
 * registry alongside every other feature's actions.
 *
 * `ActionSpec`'s handler param is contravariant, so a map of typed specs
 * (each with its own config type) can't be widened to `ActionSpec<unknown>`
 * without an explicit `any` here, the same shape as every sibling actions
 * module (see `./extended`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proposalActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  send_proposal: sendProposal,
}
