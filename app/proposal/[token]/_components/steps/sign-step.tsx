'use client';

/**
 * The stepper's second pane: the locked contract body (already sanitised
 * server-side by `renderContractHtml`, the same as the public contract
 * page) above the signing fields.
 *
 * @module app/proposal/[token]/_components/steps/sign-step
 */
import { useState } from 'react';

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { SignFormFields } from '@/components/contracts/sign-form-fields';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';
import type { SignatureMode } from '@/lib/contracts/signature-image';
import type { AcceptResponse } from '@/lib/proposals/close-types';

/** Props for {@link SignStep}: the rendered draft contract, the signer's name, and the sign request's busy and error state. */
export interface SignStepProps {
  contract: AcceptResponse;
  branding: PublicBranding;
  /** Placeholder for the name field: whose signature this is. */
  coupleName: string;
  busy: boolean;
  error: string | null;
  onSign: (input: { signerName: string; signatureMode: SignatureMode; signatureImage: string | null }) => void;
  /** "Back" to the choose step, wired to `SignFormFields`' decline slot. */
  onBack: () => void;
}

/** See {@link SignStepProps}. */
export function SignStep({ contract, branding, coupleName, busy, error, onSign, onBack }: SignStepProps) {
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('typed');
  const [drawnImage, setDrawnImage] = useState<string | null>(null);
  // Collapsed by default: a bounded, bordered reading pane keeps the name
  // field, agreement checkbox and signature pad on screen below it no
  // matter how long the contract runs. "Read the full agreement" swaps to
  // the outer dialog's own scroll instead of a second scrollbar nested
  // inside it, which reads clearer on a phone than a taller fixed box would.
  const [expanded, setExpanded] = useState(false);

  const headingStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'));
  const captionStyle = resolveTextStyle(undefined, roleDefaults(branding, 'finePrint'));

  return (
    <div className="space-y-4">
      <h3 className="m-0" style={headingStyle}>
        Your agreement
      </h3>
      <div className="space-y-1">
        {/* Already sanitised server-side; safe to inject verbatim, same as
            the public contract page. The box itself still scrolls (so a
            couple who just wants to check a clause never has to expand
            it), but it is a bordered, named reading pane now rather than a
            cramped 40vh strip, and taller on the phone widths this is
            actually read on than the desktop dialog leaves room for. */}
        <div
          className={expanded ? undefined : 'max-h-[45vh] overflow-y-auto sm:max-h-[50vh]'}
          style={{
            color: branding.text_color,
            borderColor: branding.border_color,
            borderWidth: 1,
            borderRadius: branding.corner_radius,
            padding: 12,
          }}
          dangerouslySetInnerHTML={{ __html: contract.contract.locked_content_html }}
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="underline"
          style={{ ...captionStyle, color: branding.muted_color }}
        >
          {expanded ? 'Show less' : 'Read the full agreement'}
        </button>
      </div>
      <SignFormFields
        signerName={signerName}
        onSignerNameChange={setSignerName}
        agreed={agreed}
        onAgreedChange={setAgreed}
        signatureMode={signatureMode}
        onSignatureModeChange={setSignatureMode}
        drawnImage={drawnImage}
        onDrawnImageChange={setDrawnImage}
        onSign={() => onSign({ signerName, signatureMode, signatureImage: signatureMode === 'drawn' ? drawnImage : null })}
        onDecline={onBack}
        loading={busy}
        error={error}
        namePlaceholder={coupleName}
        signLabel="Sign and confirm"
        declineLabel="Back"
      />
    </div>
  );
}
