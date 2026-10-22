'use client';

import { InlineInput } from '@/components/ui-v2/inline-input';

import { useOwnSignature } from '../../settings/own-signature';
import { SignatureEditor } from '../../settings/signature-editor';

/**
 * The foot of an email, written where it sits (founder, 2026-10-21: the
 * popover it was written in jumped about with every key, and a choice of
 * signatures was one too many, since a first name alone is a signature
 * the MC can write). The words above it ("Warmly,"), this email's own;
 * then the MC's signature, the one Settings > Email holds, so a change
 * here signs off every email. Its formatting bar floats over it while it
 * is being written, so nothing under the caret moves.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-signature
 */

export interface EmailSignatureProps {
  signOff: string;
  onSignOff: (signOff: string) => void;
}

/** The signature. See {@link EmailSignatureProps}. */
export function EmailSignature({ signOff, onSignOff }: EmailSignatureProps) {
  const own = useOwnSignature();
  return (
    <div className="space-y-4 pt-2 type-body">
      <InlineInput aria-label="Sign-off" placeholder="Sign-off, e.g. Warmly," value={signOff} onChange={(e) => onSignOff(e.target.value)} className="w-full text-zebra-700" />
      <SignatureEditor inline value={own.value} onChange={own.save} />
    </div>
  );
}
