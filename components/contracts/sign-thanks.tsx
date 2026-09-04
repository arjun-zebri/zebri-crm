/**
 * What the signer sees the moment their signature lands.
 *
 * This replaces the green banner that used to appear on the document itself.
 * A confirmation is a thing that happens once, at the moment of the act, which
 * is what a dialog is for. Bolting it to the top of the contract meant every
 * later visit reopened with the same announcement, in a tinted box, above
 * signature panels that already carried the name and the date.
 *
 * Lives in `components/` rather than beside the page for the reason spelled out
 * in {@link module:components/contracts/sign-form-fields}: the contract page is
 * a branded public surface, but a dialog on top of it is app chrome and should
 * look like the rest of the product.
 *
 * @module components/contracts/sign-thanks
 */
'use client';

import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface SignThanksProps {
  /** The name the signer typed, for the greeting. Empty is handled. */
  signerName: string;
  /** Everyone still owing a signature. Empty means the contract is complete. */
  waitingOn: string[];
  onClose: () => void;
}

export function SignThanks({ signerName, waitingOn, onClose }: SignThanksProps) {
  const name = signerName.trim();
  // Naming who is left is the one question a signer actually has next, and it
  // is also what tells them the contract is not yet in force.
  const detail =
    waitingOn.length > 0
      ? `The contract is complete once ${waitingOn.join(' and ')} ${
          waitingOn.length === 1 ? 'has' : 'have'
        } signed. We'll email you a copy then.`
      : 'Everyone has signed. A copy is on its way to your inbox.';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <CheckCircle2
          size={20}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0 text-success"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-body text-text">
            Thanks{name ? `, ${name}` : ''}. Your signature is recorded.
          </p>
          <p className="text-body text-text-muted">{detail}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
