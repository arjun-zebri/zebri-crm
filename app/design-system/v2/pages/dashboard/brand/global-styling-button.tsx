'use client';

import type { CSSProperties } from 'react';

import { Button } from '@/components/ui-v2/button';

import { openYourLook } from './your-look-store';

/**
 * Global styling, from inside an editor: the way to the one look every
 * document wears (logo, colours, fonts, spacing), marked by the brand's
 * two colours. The same button in every editor (a document's bottom bar,
 * an email's foot), so the look is changed in one place, never per
 * document (founder, 2026-10-21: everything edited in one place).
 *
 * @module app/design-system/v2/pages/dashboard/brand/global-styling-button
 */

/** The brand's two colours, overlapping, as the button's icon. */
function BrandDots({ main, accent }: { main: string; accent: string }) {
  // The MC's colours, known only at runtime.
  const vars = { '--dot-a': main, '--dot-b': accent } as CSSProperties;
  return (
    <span aria-hidden="true" style={vars} className="flex">
      <span className="size-3.5 rounded-pill bg-[var(--dot-a)] ring-2 ring-field" />
      <span className="-ml-1.5 size-3.5 rounded-pill bg-[var(--dot-b)] ring-2 ring-field" />
    </span>
  );
}

/** The button; `main` and `accent` are the brand's colours. */
export function GlobalStylingButton({ main, accent }: { main: string; accent: string }) {
  return (
    <Button variant="ghost" icon={<BrandDots main={main} accent={accent} />} onClick={openYourLook}>
      Global styling
    </Button>
  );
}
