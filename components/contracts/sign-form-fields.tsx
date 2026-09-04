/**
 * The signing form's fields, as they appear inside the signing dialog.
 *
 * WHY THIS LIVES IN `components/` AND NOT BESIDE THE PAGE. The contract page is
 * a branded public surface: `scripts/check-public-surface-styling.mjs` bans app
 * tokens under `app/contract/**` so the couple sees the MC's brand rather than
 * Zebri's. That rule is right for the DOCUMENT, and it is why the signature
 * lines are styled from branding.
 *
 * A dialog is not the document. It is app chrome sitting on top of it and
 * should look like the rest of the product. Hand-rolling it from inline styles
 * produced controls at the wrong sizes and off the type scale. Living here lets
 * it use the real primitives (`Button`, `Input`, `Checkbox`), which carry the
 * single 32px control height and the three-size type scale.
 *
 * The one branded thing kept is the signature preview, which is the mark the
 * signer is about to make.
 *
 * @module components/contracts/sign-form-fields
 */
'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  SignaturePad,
  SIGNATURE_PAD_TOTAL_HEIGHT,
} from '@/components/ui/signature-pad';
import { SIGNATURE_FONT_STACK } from '@/lib/branding/signature-font';
import type { SignatureMode } from '@/lib/contracts/signature-image';

export interface SignFormFieldsProps {
  signerName: string;
  onSignerNameChange: (next: string) => void;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
  signatureMode: SignatureMode;
  onSignatureModeChange: (next: SignatureMode) => void;
  drawnImage: string | null;
  onDrawnImageChange: (next: string | null) => void;
  onSign: () => void;
  onDecline: () => void;
  loading: boolean;
  error: string | null;
  /** Placeholder for the name field: who this link belongs to. */
  namePlaceholder: string;
  /** Button labels, which the MC can override in Branding. */
  signLabel: string;
  declineLabel: string;
}

export function SignFormFields({
  signerName,
  onSignerNameChange,
  agreed,
  onAgreedChange,
  signatureMode,
  onSignatureModeChange,
  drawnImage,
  onDrawnImageChange,
  onSign,
  onDecline,
  loading,
  error,
  namePlaceholder,
  signLabel,
  declineLabel,
}: SignFormFieldsProps) {
  const drawing = signatureMode === 'drawn';
  // The typed name identifies the signer in both modes; a drawn mark also
  // needs actual ink before Sign becomes available.
  const canSign = signerName.trim().length > 0 && agreed && (!drawing || Boolean(drawnImage));

  const nameField = (
    <Input
      label="Your full legal name"
      value={signerName}
      onChange={(e) => onSignerNameChange(e.target.value)}
      placeholder={namePlaceholder}
    />
  );

  return (
    <div className="space-y-4">
      {/* How you sign comes first: it decides what the rest of the form is. */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={drawing ? 'outline' : 'primary'}
          onClick={() => onSignatureModeChange('typed')}
        >
          Type
        </Button>
        <Button
          variant={drawing ? 'primary' : 'outline'}
          onClick={() => onSignatureModeChange('drawn')}
        >
          Draw
        </Button>
      </div>

      {nameField}

      {/* Reserve EXACTLY the pad's height for both modes. A min-height was not
          enough: the pad is taller than the typed preview, so switching to Draw
          still grew the dialog under the reader's cursor. */}
      <div style={{ height: SIGNATURE_PAD_TOTAL_HEIGHT }}>
        {drawing ? (
          <SignaturePad
            value={drawnImage}
            onChange={onDrawnImageChange}
            label="Draw your signature"
          />
        ) : (
          <div className="flex h-full flex-col rounded-control border border-border bg-surface px-3 py-2">
            <p className="text-body text-text-muted">Your signature will appear as</p>
            <p
              className="flex flex-1 items-center text-text"
              style={{ fontFamily: SIGNATURE_FONT_STACK, fontSize: 28, lineHeight: 1.4 }}
            >
              {signerName || ' '}
            </p>
          </div>
        )}
      </div>

      <Checkbox
        checked={agreed}
        onChange={onAgreedChange}
        label="I agree to the terms above and intend this to serve as my legal signature."
      />

      {error ? <p className="text-body text-danger">{error}</p> : null}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onSign} disabled={!canSign} loading={loading}>
          {signLabel}
        </Button>
        <Button variant="outline" onClick={onDecline} disabled={loading}>
          {declineLabel}
        </Button>
      </div>
    </div>
  );
}
