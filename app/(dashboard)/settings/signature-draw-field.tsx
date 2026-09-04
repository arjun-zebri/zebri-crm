/**
 * The MC's drawn signature control in Settings → Personal info.
 *
 * Sits beside the typed "Signature name" field rather than replacing it: the
 * typed name identifies the supplier on the document and is also the fallback
 * for anyone who has not drawn one. Drawing is the upgrade.
 *
 * Saves on release rather than on a Save button, matching the auto-save
 * behaviour of the rest of this settings page.
 *
 * @module app/(dashboard)/settings/signature-draw-field
 */
'use client';

import { useState } from 'react';

import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/components/ui/toast';

import { saveSignatureImageAction } from './signature-actions';

export interface SignatureDrawFieldProps {
  /** The saved signature data URL, or null. */
  value: string | null;
}

export function SignatureDrawField({ value }: SignatureDrawFieldProps) {
  const [signature, setSignature] = useState<string | null>(value);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const persist = async (next: string | null) => {
    setSignature(next);
    setSaving(true);
    const res = await saveSignatureImageAction({ signature: next });
    setSaving(false);
    if (!res.ok) {
      toast(res.error, 'error');
      // Roll back to what is actually stored, so the pad never shows a
      // signature the server rejected.
      setSignature(value);
      return;
    }
    toast(next ? 'Signature saved.' : 'Signature removed.');
  };

  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-body font-medium text-gray-700">
        Drawn signature
      </label>
      <p className="mb-2 text-body text-text-muted">
        Optional. Drawn here once and stamped on every contract you send.
        Changing it never alters a contract you have already sent.
      </p>
      <SignaturePad
        value={signature}
        onChange={(next) => void persist(next)}
        label="Draw your signature"
        disabled={saving}
      />
      {signature ? (
        <div className="mt-2 rounded-control border border-border bg-surface-muted p-3">
          <p className="mb-1 text-body text-text-muted">Preview</p>
          {/* Stored as a data URL, so no next/image loader applies. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signature} alt="Your signature" className="block h-12 w-auto max-w-full" />
        </div>
      ) : null}
    </div>
  );
}
