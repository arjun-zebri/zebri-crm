import type { Swatch } from '@/components/ui-v2/swatch-picker';

import type { Brand } from '../../onboarding/use-onboarding-state';
import { BRAND } from '../proposals/templates-data';

/**
 * The choices the Style controls offer, curated so a brand cannot end up
 * looking cheap: brand colours that hold white text and print well, font
 * pairings that have been set together, and the one-colour rule (the MC
 * picks a brand colour; the soft accent is mixed from it, so the two
 * always belong together).
 *
 * @module app/design-system/v2/pages/dashboard/brand/palettes
 */

/** Brand colours an MC's documents look good in, deep enough to carry white text. */
export const BRAND_COLOURS: Swatch[] = [
  { value: '#2f521f', name: 'Forest' },
  { value: '#1c446e', name: 'Navy' },
  { value: '#6b1f2e', name: 'Burgundy' },
  { value: '#1f1f1d', name: 'Ink' },
  { value: '#a4502f', name: 'Terracotta' },
  { value: '#4b2a5a', name: 'Plum' },
  { value: '#1f5a55', name: 'Teal' },
  { value: '#8a6a2f', name: 'Antique gold' },
];

/** A heading face and a body face that read well together, with a name for the feel. */
export interface FontPairing {
  name: string;
  heading: string;
  body: string;
}

/** The pairings, most classic first. Labels are `FONT_LABELS` values. */
export const PAIRINGS: FontPairing[] = [
  { name: 'Classic', heading: 'Italiana', body: 'Inter' },
  { name: 'Editorial', heading: 'Playfair Display', body: 'Manrope' },
  { name: 'Romantic', heading: 'Cormorant Garamond', body: 'Figtree' },
  { name: 'Modern', heading: 'Instrument Serif', body: 'Jost' },
  { name: 'Timeless', heading: 'EB Garamond', body: 'Lora' },
  { name: 'Bold', heading: 'DM Serif Display', body: 'Inter' },
];

/** The pairing a brand's fonts make, if it is one of ours. */
export const pairingOf = (b: Brand) => PAIRINGS.find((p) => p.heading === b.headingFont && p.body === b.bodyFont);

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/**
 * The soft accent for a brand colour: 10% of it over Zebri's warm paper,
 * as a hex (the documents need a real colour, not a `color-mix`, since
 * the accent is also saved on the brand).
 */
export function accentOf(primary: string): string {
  const paper = [0xf7, 0xf7, 0xf4];
  const c = [1, 3, 5].map((i) => parseInt(primary.slice(i, i + 2), 16));
  if (c.some(Number.isNaN)) return BRAND.secondary;
  return `#${c.map((v, i) => hex2(paper[i]! * 0.9 + v * 0.1)).join('')}`;
}

/** A brand with a new brand colour, its accent mixed to match. */
export const withColour = (b: Brand, primary: string): Brand => ({ ...b, primary, secondary: accentOf(primary) });

/** Zebri's default look: what every account wears until the MC makes it theirs. */
export const DEFAULT_BRAND: Brand = BRAND;
