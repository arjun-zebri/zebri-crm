/**
 * Turn a signed proposal contract into the booking: invoice + stages via the
 * `finalize_proposal_acceptance` RPC, then the MC notifications.
 *
 * Runs with the admin client because the caller is the anonymous sign route:
 * there is no MC session to read the schedule or the Connect flag with. The
 * RPC still resolves the contract through the couple's signer token (C1), so
 * the admin read here is for inputs only, never for authority.
 *
 * @module lib/proposals/finalize
 */
import { logger } from '@/lib/alerts/logger'
import { stripeConnectEnabled } from '@/lib/auth/entitlements'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

import type { FinalizeFailure, FinalizeResult, PublicProposalInvoice } from './close-types'
import { buildInvoicePayload } from './invoice-payload'
import { loadSchedule } from './load-schedule'
import { notifyProposalAccepted } from './notify'
import type { PublicProposalOption } from './public-types'

/**
 * Finalize the acceptance behind a contract signer token. Idempotent: a
 * second call returns the existing invoice and sends nothing.
 *
 * A failure carries the MC and proposal ids from the point they are known so
 * the caller's alert can name them (see `lib/contracts/after-sign.ts`).
 */
export async function finalizeProposalAcceptance(signToken: string): Promise<FinalizeResult | FinalizeFailure> {
  const admin = createAdminClient()
  // sign_token is a bearer credential (like a password-reset link), so it is
  // deliberately never included in a log context below.
  const { data: signer, error: signerError } = await admin.from('contract_signers').select('contract_id').eq('sign_token', signToken).maybeSingle()
  if (signerError) {
    logger.error('[proposals/finalize] signer lookup failed', signerError)
    return { ok: false, error: 'read_error' }
  }
  if (!signer) return { ok: false, error: 'not_found' }

  const { data: contract, error: contractError } = await admin.from('contracts').select('id, status, proposal_id, user_id').eq('id', signer.contract_id).maybeSingle()
  if (contractError) {
    logger.error('[proposals/finalize] contract lookup failed', contractError, { contractId: signer.contract_id })
    return { ok: false, error: 'read_error' }
  }
  if (!contract?.proposal_id) return { ok: false, error: 'not_a_proposal' }
  const ids = { userId: contract.user_id, proposalId: contract.proposal_id }
  if (contract.status !== 'signed') return { ok: false, error: 'not_signed', ...ids }

  const { data: proposal, error: proposalError } = await admin
    .from('proposals')
    .select('id, title, deposit_percent, payment_schedule_id, accepted_option_id, accepted_addon_selection, couple:couple_id(event_date), proposal_options!proposal_options_proposal_id_fkey(*, proposal_option_items(*))')
    .eq('id', contract.proposal_id)
    .maybeSingle()
  if (proposalError) {
    logger.error('[proposals/finalize] proposal lookup failed', proposalError, { proposalId: contract.proposal_id, contractId: contract.id })
    return { ok: false, error: 'read_error', ...ids }
  }
  if (!proposal?.accepted_option_id) return { ok: false, error: 'not_found', ...ids }
  const option = (proposal.proposal_options as unknown as Array<PublicProposalOption & { proposal_option_items: PublicProposalOption['items'] }>)
    .map((o) => ({ ...o, items: o.proposal_option_items }))
    .find((o) => o.id === proposal.accepted_option_id)
  if (!option) return { ok: false, error: 'not_found', ...ids }

  // Stage precedence (ruling W1): the proposal's own schedule, else its
  // deposit_percent pair, else the MC's default schedule, else full payment.
  // The default is only consulted when the proposal names neither, so the
  // deposit the couple saw on the page is the deposit the invoice carries.
  const schedule = await loadSchedule(admin, proposal.payment_schedule_id, contract.user_id, proposal.deposit_percent)
  const { data: mc } = await admin.auth.admin.getUserById(contract.user_id)
  const { payload, warning } = buildInvoicePayload({
    title: proposal.title,
    option,
    selectedAddonIds: (proposal.accepted_addon_selection as string[] | null) ?? [],
    schedule,
    depositPercent: proposal.deposit_percent,
    eventDate: (proposal.couple as { event_date: string | null } | null)?.event_date ?? null,
    issueDate: new Date().toISOString().slice(0, 10),
    stripePaymentEnabled: stripeConnectEnabled(mc?.user ?? null),
  })
  // A degraded (single full-payment) stage substitution still finalizes the
  // booking, correctly totalled, so this is logged rather than failing the
  // acceptance the couple is actively completing.
  if (warning) {
    logger.error('[proposals/finalize] degraded stages', new Error(warning), { proposalId: proposal.id })
  }

  const { data, error } = await admin.rpc('finalize_proposal_acceptance', { p_token: signToken, p_invoice: payload as unknown as Json })
  if (error) {
    logger.error('[proposals/finalize] RPC failed', error, { contractId: contract.id })
    return { ok: false, error: 'rpc_failed', ...ids }
  }
  const r = data as {
    ok?: boolean
    error?: string
    invoice_id: string
    share_token: string
    invoice_number: string
    stripe_payment_enabled: boolean
    first_stage: PublicProposalInvoice['first_stage']
    already_finalized: boolean
  }
  if (r.error) return { ok: false, error: r.error, ...ids }
  const invoice: PublicProposalInvoice = {
    id: r.invoice_id,
    share_token: r.share_token,
    invoice_number: r.invoice_number,
    stripe_payment_enabled: r.stripe_payment_enabled,
    paid_at: null,
    first_stage: r.first_stage,
  }
  if (!r.already_finalized) {
    // Fire-and-forget: the booking is confirmed regardless of whether the MC's
    // inbox or Slack is reachable.
    void notifyProposalAccepted(admin, proposal.id, payload.subtotal, r.invoice_number).catch((err: unknown) =>
      logger.error('[proposals/finalize] notify failed', err, { proposalId: proposal.id }),
    )
  }
  return { ok: true, invoice, already_finalized: r.already_finalized }
}
