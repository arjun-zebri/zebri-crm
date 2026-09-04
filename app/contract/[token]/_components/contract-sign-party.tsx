/**
 * One party's slot on the public contract: their signature line.
 *
 * Panel only. The signing action used to live in here, inside whichever panel
 * belonged to the viewer, which on a two-partner contract put a name field, a
 * checkbox and two buttons in between the two signature lines. It now renders
 * once after the last panel; see `contract-sign-form`.
 *
 * Renders nothing when the contract has no such party (a couple with one named
 * contact, or a contract with no supplier row yet).
 *
 * @module app/contract/[token]/_components/contract-sign-party
 */
import type { ReactNode } from 'react';

import { partySigner, type SignParty } from './contract-parties';
import { ContractSignaturePanel, type PartyBlock } from './contract-signature-panel';
import type { PublicContract } from './public-contract';

export interface ContractSignPartyProps {
  contract: PublicContract;
  party: SignParty;
  /** The MC's role noun, kept for the panel's props shape. */
  vendorRole?: string;
  textColor: string;
  mutedColor: string;
  /** This party's block config (labels, typography). */
  block?: PartyBlock | undefined;
  /** The "Sign here" control, for the slot belonging to this link's holder. */
  action?: ReactNode | undefined;
}

export function ContractSignParty({
  contract,
  party,
  vendorRole,
  textColor,
  mutedColor,
  block,
  action,
}: ContractSignPartyProps) {
  const signer = partySigner(contract, party);
  // No such party on this contract: render nothing rather than an empty slot.
  if (!signer) return null;

  return (
    <ContractSignaturePanel
      contract={contract}
      party={party}
      signer={signer}
      textColor={textColor}
      mutedColor={mutedColor}
      {...(vendorRole ? { vendorRole } : {})}
      {...(block ? { block } : {})}
      {...(action ? { action } : {})}
    />
  );
}
