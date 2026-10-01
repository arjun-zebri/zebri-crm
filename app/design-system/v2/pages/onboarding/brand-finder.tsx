'use client';

import { Check, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';

import type { Brand } from './use-onboarding-state';

/**
 * "We found your brand on your website": after the MC enters their
 * site, offer the colours and heading font found there, so step 3
 * starts filled in. Demo: the lookup is simulated and always finds the
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

export function BrandFinder({ status, domain, onUse, onDismiss }: BrandFinderProps) {
  if (status === 'idle' || status === 'dismissed') return null;
  if (status === 'looking')
    return (
      <p role="status" className="flex items-center gap-2 type-body text-zebra-500">
        <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4 animate-pulse text-grass-700" />
        Looking for your brand on {domain}…
      </p>
    );
  if (status === 'used')
    return (
      <p role="status" className="flex items-center gap-2 type-body text-grass-800">
        <Check aria-hidden="true" strokeWidth={1.5} className="size-4" />
        Your brand from {domain} is applied. Fine-tune it in step 3.
      </p>
    );
  return (
    <Panel tone="highlight" role="status" className="flex flex-wrap items-center gap-4 p-4 motion-safe:animate-[reveal-up_400ms_cubic-bezier(0.22,1,0.36,1)_both]">
      <span className="flex -space-x-1.5" aria-hidden="true">
        {[FOUND_BRAND.primary, FOUND_BRAND.secondary].map((c) => (
          <span key={c} className="size-7 rounded-pill border-2 border-field bg-[var(--c)]" style={{ '--c': c } as React.CSSProperties} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-label text-zebra-950">We found your brand on {domain}</span>
        <span className="block type-body text-zebra-500">Two colours and your heading font. Use them as your starting point?</span>
      </span>
      <span className="flex gap-2">
        <Button onClick={onUse}>Use it</Button>
        <Button variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </span>
    </Panel>
  );
}
