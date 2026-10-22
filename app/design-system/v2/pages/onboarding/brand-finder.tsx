'use client';

import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { BrandSearchIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';

import type { Brand } from './use-onboarding-state';

/**
 * "We found your brand on your website": after the MC enters their
 * site, offer the colours and heading font found there, so their
 * documents start in their own look. Demo: the lookup is simulated and always finds the
 * same palette.
 *
 * @module app/design-system/v2/pages/onboarding/brand-finder
 */

/** Lookup state for the website brand match. */
export type FinderStatus = 'idle' | 'looking' | 'found' | 'used' | 'dismissed';

/** What the simulated lookup "finds". */
export const FOUND_BRAND: Partial<Brand> = { primary: '#1c446e', secondary: '#ddeffd', headingFont: 'Playfair Display' };

export interface BrandFinderProps {
  status: FinderStatus;
  domain: string;
  onUse: () => void;
  onDismiss: () => void;
}

/** The found colours, overlapping, as they appear in the offer and once applied. */
function Swatches() {
  return (
    <span className="flex -space-x-1.5" aria-hidden="true">
      {[FOUND_BRAND.primary, FOUND_BRAND.secondary].map((c) => (
        <span key={c} className="size-7 rounded-pill border-2 border-field bg-[var(--c)]" style={{ '--c': c } as React.CSSProperties} />
      ))}
    </span>
  );
}

export function BrandFinder({ status, domain, onUse, onDismiss }: BrandFinderProps) {
  if (status === 'idle' || status === 'dismissed') return null;
  if (status === 'looking')
    return (
      <p role="status" className="flex items-center gap-2 type-body text-zebra-500">
        <BrandSearchIcon aria-hidden="true" className="size-4 animate-pulse text-grass-700 motion-reduce:animate-none" />
        Looking for your brand on {domain}…
      </p>
    );
  // Applied: the same panel stays put and turns into the proof, the
  // swatches it offered now ticked, so the MC sees what changed rather
  // than reading a line about a later step (there is no later step).
  if (status === 'used')
    return (
      <Panel tone="highlight" role="status" className="flex items-center gap-4 p-4">
        <span className="relative">
          <Swatches />
          <span aria-hidden="true" className="absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-pill border-2 border-field bg-grass-100 text-grass-800">
            <DrawnCheck className="size-3.5" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block type-label text-zebra-950">Your brand is in</span>
          <span className="block type-body text-zebra-500">Change it any time in Settings.</span>
        </span>
      </Panel>
    );
  return (
    <Panel tone="highlight" role="status" className="flex flex-wrap items-center gap-4 p-4 motion-safe:animate-reveal-up">
      <Swatches />
      <span className="min-w-0 flex-1">
        <span className="block type-label text-zebra-950">We found your brand on {domain}</span>
        <span className="block type-body text-zebra-500">Two colours and your heading font. Use them as your starting point?</span>
      </span>
      {/* Primary last, as in every footer. */}
      <span className="flex gap-3">
        <Button variant="plain" onClick={onDismiss}>
          Not now
        </Button>
        <Button onClick={onUse}>Use it</Button>
      </span>
    </Panel>
  );
}
