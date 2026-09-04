/**
 * The signing action, rendered once after every signature line.
 *
 * WHY IT IS NOT INSIDE A SIGNATURE PANEL. It used to render inside the panel
 * belonging to whoever held the link, on the theory that the form should sit
 * beside the signature it produces. On a two-partner contract that put a name
 * field, a checkbox and two buttons in between the two signature lines, where
 * it read as belonging to neither. A signature page lists the parties, then you
 * sign: the form goes at the end.
 *
 * Renders nothing unless this link's holder actually has something to do.
 *
 * @module app/contract/[token]/_components/contract-sign-form
 */
import { SignFormFields } from '@/components/contracts/sign-form-fields';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { roleDefaults } from '@/lib/branding/type-defaults';
import type { SignatureMode } from '@/lib/contracts/signature-image';

import { ContractOtpGate } from './contract-otp-gate';
import { isMyTurn, isViewer, partySigner, signersAhead } from './contract-parties';
import type { PartyBlock } from './contract-signature-panel';
import {
  outstandingSigners,
  viewerSigner,
  type PageState,
  type PublicContract,
} from './public-contract';

export interface ContractSignFormProps {
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
  signatureMode: SignatureMode;
  onSignatureModeChange: (next: SignatureMode) => void;
  drawnImage: string | null;
  onDrawnImageChange: (next: string | null) => void;
  textColor: string;
  mutedColor: string;
  /** The viewer's own signature block, for labels and button styling. */
  block?: PartyBlock | undefined;
  /** The share token, for the verification gate's requests. */
  token?: string | undefined;
  /** Reload the contract once verification succeeds, unlocking the form. */
  onVerified?: (() => void) | undefined;
}

export function ContractSignForm({
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
  signatureMode,
  onSignatureModeChange,
  drawnImage,
  onDrawnImageChange,
  textColor,
  mutedColor,
  block,
  token,
  onVerified,
}: ContractSignFormProps) {
  const me = viewerSigner(contract);
  // A legacy share link, or the MC previewing their own document: nobody is
  // being asked to sign, so nothing renders.
  if (!me || !isViewer(contract, me)) return null;

  const done = Boolean(me.signed_at || me.declined_at);
  const active = pageState === 'active';
  const myTurn = isMyTurn(contract, me);
  const ahead = signersAhead(contract, me);
  const needsVerification =
    Boolean(contract.require_signer_otp) && !contract.viewer_otp_verified;

  const finePrintDefaults = roleDefaults(contract, 'finePrint');
  const sectionHeadingDefaults = roleDefaults(contract, 'sectionHeading');
  const fineStyle = {
    color: mutedColor,
    fontSize: `${finePrintDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
    lineHeight: finePrintDefaults.lineHeight,
  };

  if (!active) return null;

  // Already done, but the contract is still open because someone else has not
  // signed. Showing the form again invites a second attempt the RPC rejects.
  if (done) {
    const waitingOn = outstandingSigners(contract);
    return (
      <div>
        <p
          style={{
            color: textColor,
            fontSize: `${sectionHeadingDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[sectionHeadingDefaults.fontFamily as never],
            lineHeight: sectionHeadingDefaults.lineHeight,
          }}
        >
          Thanks, {me.name}. Your signature is recorded.
        </p>
        <p className="mt-1" style={fineStyle}>
          {waitingOn.length > 0
            ? `The contract is complete once ${waitingOn
                .map((s) => s.name)
                .join(' and ')} ${waitingOn.length === 1 ? 'has' : 'have'} signed.`
            : 'Nothing further is needed from you.'}
        </p>
      </div>
    );
  }

  // Held behind someone ahead of them on a sequential contract.
  if (!myTurn) {
    return (
      <p style={fineStyle}>
        {ahead.map((s) => s.name).join(' and ')}{' '}
        {ahead.length === 1 ? 'signs' : 'sign'} first. We&apos;ll email you as soon as
        they have.
      </p>
    );
  }

  if (needsVerification && token) {
    return (
      <ContractOtpGate token={token} onVerified={onVerified ?? (() => undefined)} />
    );
  }

  return (
    <SignFormFields
      signerName={signerName}
      onSignerNameChange={onSignerNameChange}
      agreed={agreed}
      onAgreedChange={onAgreedChange}
      signatureMode={signatureMode}
      onSignatureModeChange={onSignatureModeChange}
      drawnImage={drawnImage}
      onDrawnImageChange={onDrawnImageChange}
      onSign={onSign}
      onDecline={onDecline}
      loading={actionLoading}
      error={actionError}
      namePlaceholder={me.name}
      signLabel={block?.primaryLabel ?? 'Sign contract'}
      declineLabel={block?.secondaryLabel ?? 'Decline'}
    />
  );
}

/** Whether the viewer's own signature block should supply the form's styling. */
export function viewerPartyOf(contract: PublicContract): 'vendor' | 'primary' | 'secondary' | null {
  for (const party of ['vendor', 'primary', 'secondary'] as const) {
    const signer = partySigner(contract, party);
    if (signer && signer.id === contract.viewer_signer_id) return party;
  }
  return null;
}
