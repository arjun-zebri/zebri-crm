/**
 * The document-level status banner for a contract, chosen by page state.
 *
 * Declined and expired contracts get a banner; active and signed ones get
 * nothing. This used to live inside the single stacked sign section. Now that
 * signatures are split per party, the banner is a document-level thing again:
 * it belongs once per page, not once per signatory, so it renders above the
 * first signature panel.
 *
 * There is deliberately no signed banner. A green box announcing "Signed by X
 * on <date>, IP <address>" sat on top of the signature panels that already say
 * exactly that, per party, in the MC's own type. The signer is told once, in a
 * dialog, at the moment they sign; after that the document speaks for itself.
 *
 * @module app/contract/[token]/_components/contract-status-slot
 */
import { ContractStatusBanner } from './contract-status-banner';
import type { PageState, PublicContract } from './public-contract';

export interface ContractStatusSlotProps {
  contract: PublicContract;
  pageState: PageState;
}

/** Renders the banner for the current page state, or nothing when active. */
export function ContractStatusSlot({
  contract,
  pageState,
}: ContractStatusSlotProps) {
  if (pageState === 'declined') {
    return (
      <ContractStatusBanner
        kind="declined"
        declinedAt={contract.declined_at}
        declinedReason={contract.declined_reason}
        branding={contract}
      />
    );
  }
  if (pageState === 'expired') {
    return (
      <ContractStatusBanner
        kind="expired"
        expiresAt={contract.expires_at}
        businessName={contract.business_name}
        branding={contract}
      />
    );
  }
  return null;
}
