/**
 * Where the accept stepper opens when the page loads mid-flow. Pure: derived
 * once from the `get_public_proposal` payload, so a reload (the couple
 * reopens the email link, or a payment redirect brings them back) lands on
 * the step they left rather than restarting.
 *
 * Split out of `./use-accept-flow` so the resume rules can be unit tested
 * without React and that hook stays under its line budget.
 *
 * @module app/proposal/[token]/_components/resume-flow
 */
import { priced } from '@/lib/branding/public-blocks/proposal/package-card';
import type { AcceptResponse, PublicProposalInvoice } from '@/lib/proposals/close-types';
import { depositAmount, optionTotal } from '@/lib/proposals/pricing';
import { deriveState, type PublicProposal } from '@/lib/proposals/public-types';

/** The stepper's current pane. */
export type AcceptStep = 'choose' | 'sign' | 'pay' | 'done';

/** The stepper's state: the pane plus whatever contract/invoice is already on hand. */
export interface FlowState {
  step: AcceptStep;
  contract: AcceptResponse | null;
  invoice: PublicProposalInvoice | null;
}

/**
 * The step (and any contract/invoice already on hand) to open on.
 *
 * `pending_contract` carries everything the sign step needs except the
 * total/deposit lines, which are recomputed locally with the same pricing
 * helpers the accept route used to produce them, so a resumed session shows
 * the same numbers.
 *
 * Two pending-contract shapes do not resume on Sign:
 * - `locked_content_html` null: `accept_proposal` ran but the route's
 *   publish step failed afterwards, so there is no body to sign yet. Resume
 *   on Choose (the accepted option is already preselected by
 *   `resolveSelection`) and Continue re-runs accept, which re-publishes the
 *   same pending contract.
 * - `signed_at` set with `accepted_at` still null: the couple signed but
 *   finalize has not landed. The server page repairs that before rendering
 *   (`../_lib/self-heal`), so by the time this runs the payload normally
 *   carries `accepted_at`; if the repair itself failed, the sign step must
 *   still not reopen on a signed contract, so this resumes on Done with
 *   whatever invoice there is (usually none).
 */
export function initialFlow(proposal: PublicProposal): FlowState {
  const state = deriveState(proposal);

  if (state === 'signing' && proposal.pending_contract) {
    const pending = proposal.pending_contract;
    if (pending.signed_at) return { step: 'done', contract: null, invoice: proposal.invoice };
    if (pending.locked_content_html === null)
      return { step: 'choose', contract: null, invoice: null };
    const option = proposal.options.find((o) => o.id === proposal.accepted_option_id);
    const addonIds = proposal.accepted_addon_selection ?? [];
    const total = option ? optionTotal(priced(option), addonIds) : 0;
    return {
      step: 'sign',
      contract: {
        ok: true,
        sign_token: pending.sign_token,
        contract: {
          contract_number: pending.contract_number,
          title: pending.title,
          locked_content_html: pending.locked_content_html,
        },
        total,
        deposit: depositAmount(total, proposal.deposit_percent),
      },
      invoice: null,
    };
  }
  if (state === 'paying') return { step: 'pay', contract: null, invoice: proposal.invoice };
  if (state === 'accepted') return { step: 'done', contract: null, invoice: proposal.invoice };
  return { step: 'choose', contract: null, invoice: null };
}
