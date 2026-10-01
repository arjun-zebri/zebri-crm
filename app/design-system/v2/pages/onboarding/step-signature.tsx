'use client';

import { useState } from 'react';

import { ChipGroup } from '@/components/ui-v2/chip-group';
import { FileDrop } from '@/components/ui-v2/file-drop';
import { Input } from '@/components/ui-v2/input';

import { SignaturePad } from './signature-pad';
import type { Signature } from './use-onboarding-state';

/**
 * Step 4, Add your signature: draw it, type it (shown in a script
 * face), or upload a picture of it. Whichever was used last is the
 * signature, handed up so the step 6 replay countersigns with it.
 *
 * @module app/design-system/v2/pages/onboarding/step-signature
 */
export function StepSignature({
  name,
  onSignature,
}: {
  name: string;
  onSignature: (s: Signature) => void;
}) {
  const [mode, setMode] = useState<string[]>(['Draw']);
  const [typed, setTyped] = useState(name);
  function pickMode(next: string[]) {
    setMode(next);
    // Typing is a signature straight away: the name is already there.
    if (next[0] === 'Type' && typed.trim()) onSignature({ kind: 'typed', text: typed.trim() });
  }
  return (
    <div className="max-w-2xl space-y-6">
      <ChipGroup
        label="How you sign"
        options={['Draw', 'Type', 'Upload']}
        value={mode}
        onChange={pickMode}
      />
      {mode[0] === 'Draw' ? (
        <SignaturePad onDraw={(src) => onSignature(src ? { kind: 'image', src } : null)} />
      ) : null}
      {mode[0] === 'Type' ? (
        <div className="space-y-3">
          <Input
            label="Your name, as you sign it"
            maxLength={120}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              onSignature(
                e.target.value.trim() ? { kind: 'typed', text: e.target.value.trim() } : null,
              );
            }}
          />
          <div className="flex h-24 items-center rounded-panel border border-zebra-200 bg-field px-6">
            {/* The app's registered signature face (Caveat, --font-signature). */}
            <span className="truncate font-[family-name:var(--font-signature)] text-[40px] leading-none text-zebra-950">
              {typed}
            </span>
          </div>
        </div>
      ) : null}
      {mode[0] === 'Upload' ? (
        <FileDrop
          label="A picture of your signature"
          accept="image/png,image/jpeg,image/webp"
          help="PNG, JPEG or WebP. Redrawn to fit the contract; a dark mark on a plain background works best."
          // A data URL, not an object URL, so it survives a reload with the rest of setup.
          onFile={(file) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === 'string' &&
              onSignature({ kind: 'image', src: reader.result });
            reader.readAsDataURL(file);
          }}
        />
      ) : null}
      <p className="type-body text-zebra-500">
        Stored once and reused. Change it any time in Settings.
      </p>
    </div>
  );
}
