/**
 * Self-heal for a signed-but-unfinalized proposal contract (ruling W3b).
 *
 * The close is two writes on the couple's side: `sign_contract_v2` records
 * the signature, then `finalizeProposalAcceptance` turns it into the
 * invoice and the accepted stamp. If the second failed (a network blip, a
 * cold start that died mid-request), the proposal is left with a signed
 * `pending_contract` and no `accepted_at`: the couple would be shown the
 * sign step again for a contract they already signed, and the MC has a
 * signature with no booking behind it.
 *
 * WHY A GET REPAIRS. Finalize is idempotent and admin-scoped, and the only
 * input it needs (the signer token) is already in the payload the page just
 * loaded. Re-running it on the next visit costs one RPC and fixes the
 * state before anything is rendered, which beats waiting for a human to
 * act on the Slack alert. It runs at most once per render and only in this
 * exact state, so an ordinary page load never writes anything.
 *
 * @module app/proposal/[token]/_lib/self-heal
 */
import { logger } from '@/lib/alerts/logger';
import { finalizeProposalAcceptance } from '@/lib/proposals/finalize';
import type { PublicProposal } from '@/lib/proposals/public-types';

/** True when the contract is signed but the proposal was never stamped accepted. */
export function needsSelfHeal(proposal: PublicProposal): boolean {
  return Boolean(proposal.pending_contract?.signed_at) && !proposal.accepted_at;
}

/**
 * Finalize the acceptance if the payload shows it never landed, then reload
 * the payload so the page renders the repaired state.
 *
 * Never throws: the page must still render (with the stale payload) if the
 * repair fails again; the finalize service has already logged and the
 * failure stays visible through the `proposal_close_failed` alert the sign
 * route raised the first time.
 *
 * @param proposal - The payload `get_public_proposal` just returned.
 * @param reload - Re-reads the payload after a successful repair.
 * @param finalize - Injectable for tests; defaults to the real service.
 */
export async function selfHealProposal(
  proposal: PublicProposal,
  reload: () => Promise<PublicProposal | null>,
  finalize: typeof finalizeProposalAcceptance = finalizeProposalAcceptance,
): Promise<PublicProposal> {
  if (!needsSelfHeal(proposal) || !proposal.pending_contract) return proposal;
  try {
    const result = await finalize(proposal.pending_contract.sign_token);
    if (!result.ok) {
      logger.error('[proposal/page] self-heal finalize refused', new Error(result.error), {
        proposalId: proposal.id,
      });
      return proposal;
    }
    return (await reload()) ?? proposal;
  } catch (err: unknown) {
    logger.error('[proposal/page] self-heal finalize threw', err, { proposalId: proposal.id });
    return proposal;
  }
}
