/**
 * Per-proposal cover row (D3, R7): an image or an embed link shown behind
 * the opening section of this proposal only, overriding the account's
 * Proposal design cover for the one document. Mirrors {@link ProposalTerms}
 * / {@link ProposalIntroNote}'s layout so it reads as part of the same
 * form rather than a boxed-off widget.
 *
 * @module components/builders/parts/proposal-hero-override
 */
'use client';

import { X } from 'lucide-react';
import { useRef, useState } from 'react';

import { uploadBlockImage } from '@/app/(dashboard)/branding/upload-brand-asset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { parseEmbedUrl } from '@/lib/proposals/embed-url';
import type { HeroOverride } from '@/lib/proposals/types';

export interface ProposalHeroOverrideProps {
  value: HeroOverride | null;
  /** Null for a not-yet-saved draft; folded into the upload storage key. */
  proposalId: string | null;
  canEdit: boolean;
  onChange: (value: HeroOverride | null) => void;
}

/** See {@link ProposalHeroOverrideProps}. */
export function ProposalHeroOverride({ value, proposalId, canEdit, onChange }: ProposalHeroOverrideProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [embedInput, setEmbedInput] = useState(value?.embedUrl ?? '');
  const [embedError, setEmbedError] = useState('');
  const { toast } = useToast();

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      // A draft has no id yet, so the key falls back to `draft`; the save
      // that follows keeps the uploaded URL regardless (the URL, not the
      // key, is what's stored on the row), so the fallback only matters
      // for a second upload overwriting the first before the first save.
      const key = `proposal-${proposalId ?? 'draft'}-hero`;
      const url = await uploadBlockImage(file, key, { onError: (msg) => toast(msg, 'error') });
      onChange({ ...(value ?? {}), imagePath: url });
    } catch {
      // uploadBlockImage already surfaced a user-facing message via onError.
    } finally {
      setUploading(false);
    }
  };

  const handleEmbedBlur = () => {
    const raw = embedInput.trim();
    if (!raw) {
      setEmbedError('');
      // Emptying the field drops only the link, so an MC can keep the cover
      // image while removing the video (Remove clears both).
      if (value?.embedUrl !== undefined) onChange({ ...value, embedUrl: undefined });
      return;
    }
    if (!parseEmbedUrl(raw)) {
      setEmbedError('Paste a YouTube or Vimeo link.');
      return;
    }
    setEmbedError('');
    onChange({ ...(value ?? {}), embedUrl: raw });
  };

  const handleRemove = () => {
    setEmbedInput('');
    setEmbedError('');
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Cover</h4>
      <div className="flex flex-wrap items-center gap-3">
        {value?.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element -- small builder-side thumbnail, not a rendered document surface
          <img src={value.imagePath} alt="" className="h-8 w-14 rounded-control border border-border object-cover" />
        ) : null}
        <Button variant="secondary" loading={uploading} disabled={!canEdit} onClick={() => fileInputRef.current?.click()}>
          Upload cover image
        </Button>
        <Input
          value={embedInput}
          onChange={(e) => setEmbedInput(e.target.value)}
          onBlur={handleEmbedBlur}
          placeholder="Or paste a YouTube / Vimeo link"
          aria-label="Cover video link"
          // Spread rather than `error={embedError}`: under
          // exactOptionalPropertyTypes an explicit `undefined` is not the
          // same as an absent prop (see /design-system Validation spec).
          {...(embedError ? { error: embedError } : {})}
          disabled={!canEdit}
          className="min-w-56 flex-1"
        />
        {value ? (
          <Button variant="ghost" disabled={!canEdit} onClick={handleRemove}>
            <X size={14} strokeWidth={1.5} />
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-body text-text-muted">
        Shown behind the opening section of this proposal only. Leave empty to use your Proposal design&apos;s cover.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
