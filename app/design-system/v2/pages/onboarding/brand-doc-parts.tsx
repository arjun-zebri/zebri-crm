import type { CSSProperties, ReactNode } from 'react';


import { fontStack } from './demo-data';
import { aud, type DemoPackage } from './packages';
import type { Brand } from './use-onboarding-state';

/**
 * Shared pieces of the onboarding's branded previews (the brand step's
 * proposal and the step 6 replay): the demo wedding they are about, the
 * brand as CSS custom properties with readable text on it, and the
 * brand-coloured button.
 *
 * The brand shows up only where it earns its place (eyebrows, headings,
 * the one action, the totals), which is what makes a document look
 * expensive rather than decorated.
 *
 * @module app/design-system/v2/pages/onboarding/brand-doc-parts
 */

/** What every sample document needs to know about the MC. */
export interface DocProps {
  business: string;
  /** The MC's own name, for signatures. */
  name: string;
  logoUrl: string | null;
  packages: DemoPackage[];
  /** Deposit percent. */
  deposit: number;
}

/** A wedding a document is for: the couple as a title, the long date, the venue, and how the welcome greets them. */
export interface Wedding {
  couple: string;
  date: string;
  venue: string;
  /** "Sarah and Tom", for the welcome's "Hi …". */
  greet: string;
}

/** The demo wedding every onboarding document is for. */
export const WEDDING: Wedding = { couple: 'Sarah & Tom', date: 'Saturday 12 March 2027', venue: 'Stones of the Yarra Valley', greet: 'Sarah and Tom' };

/** Shown when the MC skipped packages, so no document is ever empty. */
export const SAMPLE_PACKAGE: DemoPackage = { name: 'Ceremony and reception', price: 1850, lines: ['Legal paperwork', 'Rehearsal', 'PA and mic'] };

/** The deposit on a price, rounded to whole dollars. */
export const depositOf = (price: number, percent: number) => Math.round((price * percent) / 100);

export { aud };

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * The text colour to set on a brand colour: white or near black,
 * whichever has the higher WCAG contrast. The app's `getTextColor` uses
 * a plain brightness cutoff that puts dark text on mid-tone greens and
 * blues, which reads as muddy; comparing contrast ratios turns text
 * light as soon as a colour is dark enough to carry it.
 */
export function readableOn(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance('#111827') + 0.05);
  return onWhite >= onDark ? '#ffffff' : '#111827';
}

/**
 * The brand as CSS custom properties, for the one `style` on whatever
 * wraps the documents. Brand values are runtime data, so they cannot be
 * Tailwind classes; the documents read them with arbitrary-value classes.
 */
export function brandVars(brand: Brand): CSSProperties {
  return {
    '--b-primary': brand.primary,
    '--b-on-primary': readableOn(brand.primary),
    // Text sitting on the accent: light when the MC picks a dark accent.
    '--b-on-secondary': readableOn(brand.secondary),
    '--b-secondary': brand.secondary,
    // A pale wash of the brand colour: selected rows, filled-in fields.
    '--b-soft': `color-mix(in oklab, ${brand.primary} 12%, white)`,
    // The brand colour lit from the top left and deepening to near black:
    // the proposal cover and the booked card in the step 6 replay.
    '--b-deep': `linear-gradient(165deg, color-mix(in oklab, ${brand.primary} 78%, white) 0%, ${brand.primary} 40%, color-mix(in oklab, ${brand.primary} 45%, black) 100%)`,
    '--b-heading': fontStack(brand.headingFont),
    '--b-body': fontStack(brand.bodyFont),
  } as CSSProperties;
}

/** The document's one action, in the brand colour with readable text on it. */
export function BrandButton({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-full items-center justify-center rounded-check bg-[var(--b-primary)] type-label text-[var(--b-on-primary)] transition-colors duration-500">
      {children}
    </span>
  );
}
