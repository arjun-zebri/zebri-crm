import type { CSSProperties } from 'react';

/**
 * The brand colour as the page's own CSS variables, so a starter's
 * brand-coloured parts (a cover, the small headings over each section)
 * follow "Your brand" live instead of keeping the colour they were made
 * in. Set on the page by the editor and every view of it; a sent page
 * sets them from the branding frozen into it, so it never changes.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/look/brand-vars
 */

/** The brand colour, wherever a starter writes a colour. */
export const BRAND_COLOUR = 'var(--doc-brand)';

/** The brand colour most of the way to black: a cover white words sit on calmly, whatever the brand. */
export const BRAND_DEEP = 'var(--doc-brand-deep)';

/** The variables for a page in `brand` (a hex colour). */
export function docBrandVars(brand: string): CSSProperties {
  return { '--doc-brand': brand, '--doc-brand-deep': `color-mix(in srgb, ${brand} 55%, black)` } as CSSProperties;
}
