'use client';

import { SignaturePad } from '../../../onboarding/signature-pad';

/**
 * The contract editor's side: one line saying what this contract is and
 * that the MC's own comes later, then (the first time only) the MC's
 * signature. The wording is Zebri's standard agreement and is not edited
 * here, just as the proposal editor only takes the brand: the send flow
 * is for sending, and the note says where their own wording goes, so
 * nobody hunts for controls that are not here. The signature is asked
 * once, so every contract after goes out already signed by them.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/contract-terms
 */

export interface ContractTermsProps {
  /** Asks for the signature: the account has none yet. */
  signing: boolean;
  onSignature: (png: string | null) => void;
}

/** The contract's side panel. See {@link ContractTermsProps}. */
export function ContractTerms({ signing, onSignature }: ContractTermsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="type-subheading text-zebra-950">Ready to sign</h3>
        <p className="type-body text-zebra-500">
          A standard MC agreement, ready to send. Later you can bring in your own contract, or make this one yours clause
          by clause.
        </p>
      </div>
      {signing ? (
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="type-label text-zebra-950">Your signature</p>
            <p className="type-body text-zebra-500">Signed once, then on every contract you send.</p>
          </div>
          <SignaturePad onDraw={onSignature} />
        </div>
      ) : null}
    </div>
  );
}
