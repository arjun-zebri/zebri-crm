/**
 * One party's signature panel on the public contract.
 *
 * Always the same three parts, whether or not the person has signed yet: the
 * mark, who made it, and when. An unsigned slot shows an empty signature rule
 * rather than a status chip, so the document reads as a signature page with a
 * line still waiting on it. That also makes the sent contract match what the MC
 * arranged in the branding editor, which previews those same three parts.
 *
 * Renders nothing when the contract has no such party, so a couple with one
 * named contact never shows an empty second-partner slot.
 *
 * Styling note: everything is inline styles resolved from the MC's branding
 * roles. `app/contract/**` is scanned by check-public-surface-styling, which
 * bans Tailwind colour and size utilities here: the couple must see the MC's
 * brand, not Zebri's tokens.
 *
 * @module app/contract/[token]/_components/contract-signature-panel
 */
import type { ReactNode } from 'react';

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import type {
  ContractSignPrimaryBlock,
  ContractSignSecondaryBlock,
  ContractSignVendorBlock,
} from '@/app/(dashboard)/branding/blocks/types';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { SIGNATURE_FONT_STACK } from '@/lib/branding/signature-font';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { partyState, signatureText, type SignParty } from './contract-parties';
import {
  formatDateTime,
  type ContractSigner,
  type PublicContract,
} from './public-contract';

/** The block config for a party panel; absent when the MC deleted the block. */
export type PartyBlock =
  | ContractSignVendorBlock
  | ContractSignPrimaryBlock
  | ContractSignSecondaryBlock;

export interface ContractSignaturePanelProps {
  contract: PublicContract;
  /** Which slot this is. Kept for the caller's shape; the panel renders the
   *  same three parts for every party. */
  party?: SignParty;
  signer: ContractSigner;
  /** The MC's role noun. Unused now that the role label is gone; kept so the
   *  caller does not have to branch. */
  vendorRole?: string;
  textColor: string;
  mutedColor: string;
  /** Block config: labels and typography. Absent on a legacy tree. */
  block?: PartyBlock | undefined;
  /**
   * Rendered inside the signature rule when this slot is still empty: the
   * "Sign here" control for the person whose link this is. The action belongs
   * at the signature, which is where someone looks for it.
   */
  action?: ReactNode | undefined;
}

/**
 * Renders one party's signature slot.
 *
 * @see ContractSignaturePanelProps
 */
export function ContractSignaturePanel({
  contract,
  signer,
  textColor,
  mutedColor,
  block,
  action,
}: ContractSignaturePanelProps) {
  const labelDefaults = roleDefaults(contract, 'body');
  const finePrintDefaults = roleDefaults(contract, 'finePrint');
  const sectionHeadingDefaults = roleDefaults(contract, 'sectionHeading');

  const labelCss = resolveTextStyle(block?.labelStyle, labelDefaults);
  const signatureCss = resolveTextStyle(block?.signatureStyle, sectionHeadingDefaults);
  const state = partyState(signer);
  const showDate = block?.showDate ?? true;

  const fineStyle = {
    fontSize: `${finePrintDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
    lineHeight: finePrintDefaults.lineHeight,
  };

  // Fixed-height rule so a signed and an unsigned panel are the same size: a
  // signature page should not reflow as people sign it.
  const ruleHeight = Math.round(sectionHeadingDefaults.fontSize * 2.2);

  return (
    <div>
      <div
        className="flex max-w-[280px] items-end border-b pb-1"
        style={{ borderBottomColor: contract.border_color, minHeight: ruleHeight }}
      >
        {state === 'signed' ? (
          signer.signature_mode === 'drawn' && signer.signature_image ? (
            // The mark as drawn. A data URL rather than a hosted image, so it
            // is already inside the serialised markup when the print window
            // fires. See the drawn-signatures migration for why that matters.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signer.signature_image}
              alt={`Signature of ${signatureText(signer)}`}
              className="block w-auto max-w-full"
              style={{ height: ruleHeight - 4 }}
            />
          ) : (
            <span
              style={{ ...signatureCss, color: textColor, fontFamily: SIGNATURE_FONT_STACK }}
            >
              {signatureText(signer)}
            </span>
          )
        ) : (
          action ?? null
        )}
      </div>

      {/* The name IS the identification. A role label above it ("Primary
          contact", "Second partner") only restated what the block already is
          and read as scaffolding on the document. */}
      <p className="mt-1.5" style={{ ...labelCss, color: textColor }}>
        {signer.name}
      </p>

      {showDate ? (
        <p style={{ ...fineStyle, color: mutedColor }}>
          {state === 'signed'
            ? formatDateTime(signer.signed_at)
            : state === 'declined'
              ? `Declined ${formatDateTime(signer.declined_at)}`
              : 'Awaiting signature'}
        </p>
      ) : null}
    </div>
  );
}
