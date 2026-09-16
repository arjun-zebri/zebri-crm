/**
 * Post-signature side effects for a contract that just reached `complete`:
 * deliver executed copies to every party, then (for a contract born from a
 * proposal) finalize the booking.
 *
 * Extracted from the sign route so that file stays under its line budget.
 * Both steps are best-effort from the couple's point of view: the signature
 * itself is already recorded and is not retractable, so nothing here may
 * turn into a failed response.
 *
 * @module lib/contracts/after-sign
 */
import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { sendExecutedCopies } from '@/lib/contracts/notify';
import type { PublicProposalInvoice } from '@/lib/proposals/close-types';
import { finalizeProposalAcceptance } from '@/lib/proposals/finalize';

/**
 * Run every side effect that follows a contract reaching `complete`.
 *
 * @param contractId - The contract that just completed.
 * @param signToken - The signer token `finalizeProposalAcceptance` resolves
 *   through (the same token the couple just signed with).
 * @returns The proposal's invoice when this contract came from an accepted
 *   proposal and finalize succeeded; null otherwise (not a proposal, or the
 *   finalize step failed: logged and alerted, never thrown to the caller).
 */
export async function runAfterSignEffects(
  contractId: string,
  signToken: string,
): Promise<PublicProposalInvoice | null> {
  await sendExecutedCopies(contractId).catch((err: unknown) => {
    logger.error('[contract/sign] executed-copy delivery failed', err, { contractId });
  });

  // A proposal contract's signature is the booking: generate the invoice and
  // stamp the proposal. Awaited (not fire-and-forget) so the caller's
  // response can carry the invoice the Pay step needs; the finalize is
  // idempotent and refuses non-proposal contracts cheaply. Wrapped in
  // try/catch because an already-recorded signature must never turn into a
  // 500 for the couple just because this step threw (network blip,
  // unexpected data shape): the failure surfaces via Slack instead.
  try {
    const finalized = await finalizeProposalAcceptance(signToken);
    if (finalized.ok) return finalized.invoice;
    // Every non-throwing failure is alerted too, not only the thrown ones: a
    // signed contract with no invoice is exactly the state a human has to
    // repair (or the next page visit self-heals), so it must not stay silent
    // in the logs. `not_a_proposal` is the normal answer for every ordinary
    // contract and is not a failure.
    if (finalized.error !== 'not_a_proposal') {
      logger.error('[contract/sign] proposal finalize failed', new Error(finalized.error), { contractId });
      void sendAlert({
        type: 'proposal_close_failed',
        severity: 'error',
        userId: finalized.userId ?? null,
        proposalId: finalized.proposalId ?? null,
        stage: 'finalize',
        reason: finalized.error,
      });
    }
    return null;
  } catch (err: unknown) {
    logger.error('[contract/sign] proposal finalize threw', err, { contractId });
    void sendAlert({
      type: 'proposal_close_failed',
      severity: 'error',
      userId: null,
      proposalId: null,
      stage: 'finalize',
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
