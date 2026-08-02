/**
 * Shared "sign / decline form + MC countersignature" section, rendered at the
 * `contractSign` marker position (or, on legacy contracts with no marker,
 * injected right after the body).
 *
 * It owns everything that used to live in the page's `bodyTrailing` slot — the
 * state-aware status banner (signed / declined / expired) or the live sign form
 * on active contracts — plus the MC countersignature, which moved here verbatim
 * from `contract-body-section.tsx`.
 *
 * The signing state machine, the sign/decline API calls and the decline dialog
 * are untouched; this component only decides WHERE the form renders and feeds it
 * the labels / colour / typography from the `contractSign` block.
 *
 * @module app/contract/[token]/_components/contract-sign-section
 */
import type { ContractSignBlock } from '@/app/(dashboard)/branding/blocks/types';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { ContractSignActions } from './contract-sign-actions';
import { ContractStatusBanner } from './contract-status-banner';
import { formatDate, type PageState, type PublicContract } from './public-contract';

export interface ContractSignSectionProps {
  contract: PublicContract;
  pageState: PageState;
  signerName: string;
  onSignerNameChange: (next: string) => void;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
  onSign: () => void;
  onDecline: () => void;
  actionLoading: boolean;
  actionError: string | null;
  onDownloadPdf: () => void;
  textColor: string;
  mutedColor: string;
  brand: string;
  radius: number;
}

/**
 * Renders the contract's sign section: a status banner or the live sign form
 * (depending on page state), followed by the MC countersignature.
 */
export function ContractSignSection({
  contract,
  pageState,
  signerName,
  onSignerNameChange,
  agreed,
  onAgreedChange,
  onSign,
  onDecline,
  actionLoading,
  actionError,
  onDownloadPdf,
  textColor,
  mutedColor,
  brand,
  radius,
}: ContractSignSectionProps) {
  const labelDefaults = roleDefaults(contract, 'sectionLabel');
  const finePrintDefaults = roleDefaults(contract, 'finePrint');
  const sectionHeadingDefaults = roleDefaults(contract, 'sectionHeading');

  // The sign form's labels, button colour and typography come from the
  // `contractSign` marker block. It is absent on legacy contracts (sent before
  // the block existed); ContractSignActions then falls back to its historical
  // labels + fine-print typography, so those contracts render identically.
  const signBlock = contract.branding_blocks?.find(
    (b): b is ContractSignBlock => b.type === 'contractSign',
  );

  return (
    <div className="space-y-6">
      {/* MC countersignature FIRST — the MC has already signed (the moment the
          contract was sent), so it reads as "signed by the MC; now you sign
          below". This also preserves the historical order on legacy contracts
          (where it lived at the end of the body, above the injected form). */}
      <div className="border-t pt-6" style={{ borderTopColor: contract.border_color }}>
        <p
          className="mb-1"
          style={{
            color: mutedColor,
            fontSize: `${labelDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
            fontWeight: labelDefaults.fontWeight,
          }}
        >
          Signed by MC
        </p>
        <p
          style={{
            color: textColor,
            fontSize: `${sectionHeadingDefaults.fontSize}px`,
            fontFamily: 'Caveat, "Brush Script MT", cursive',
            lineHeight: sectionHeadingDefaults.lineHeight,
          }}
        >
          {contract.mc_signature_name ||
            htmlToPlainText(contract.business_name) ||
            'Your MC'}
        </p>
        <p
          className="mt-1"
          style={{
            color: mutedColor,
            fontSize: `${finePrintDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            lineHeight: finePrintDefaults.lineHeight,
          }}
        >
          {htmlToPlainText(contract.business_name) || ''} ·{' '}
          {formatDate(contract.email_sent_at)}
        </p>
      </div>

      {pageState === 'signed' ? (
        <ContractStatusBanner
          kind="signed"
          signerName={contract.signer_name}
          signedAt={contract.signed_at}
          signerIp={contract.signer_ip}
          onDownloadPdf={onDownloadPdf}
          branding={contract}
        />
      ) : null}
      {pageState === 'declined' ? (
        <ContractStatusBanner
          kind="declined"
          declinedAt={contract.declined_at}
          declinedReason={contract.declined_reason}
          branding={contract}
        />
      ) : null}
      {pageState === 'expired' ? (
        <ContractStatusBanner
          kind="expired"
          expiresAt={contract.expires_at}
          businessName={contract.business_name}
          branding={contract}
        />
      ) : null}
      {pageState === 'active' ? (
        <ContractSignActions
          signerName={signerName}
          onSignerNameChange={onSignerNameChange}
          agreed={agreed}
          onAgreedChange={onAgreedChange}
          onSign={onSign}
          onDecline={onDecline}
          actionLoading={actionLoading}
          actionError={actionError}
          coupleName={contract.couple_name}
          textColor={textColor}
          mutedColor={mutedColor}
          radius={radius}
          branding={contract}
          brand={brand}
          {...(signBlock ? { signBlock } : {})}
        />
      ) : null}
    </div>
  );
}
