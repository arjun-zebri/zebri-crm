/**
 * The onboarding's package model: what step 3 edits and the brand
 * preview, documents and replay show.
 *
 * @module app/design-system/v2/pages/onboarding/packages
 */

/** One package as the demo holds it. */
export interface DemoPackage {
  name: string;
  price: number;
  lines: string[];
}

/** A price in Australian dollars, cents only when there are some. */
export const aud = (n: number) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 });
