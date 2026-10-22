import { createIcon } from './icon-base';

/**
 * Brand search glyph: a globe with a small soft spark at its top right,
 * the MC's website with something being found on it. For the moment
 * Zebri looks up the MC's logo, colours and fonts from their website
 * (onboarding's BrandFinder).
 *
 * @example
 * ```tsx
 * <BrandSearchIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/brand-search
 */
export const BrandSearchIcon = createIcon(
  'BrandSearchIcon',
  'glyph',
  <>
    <circle cx="10.5" cy="13.5" r="7" />
    <path d="M3.5 13.5h14" />
    <path d="M10.5 6.5a10 10 0 0 1 0 14a10 10 0 0 1 0-14" />
    <path d="M18.75 2.75q0 2.5 2.5 2.5q-2.5 0-2.5 2.5q0-2.5-2.5-2.5q2.5 0 2.5-2.5" />
  </>,
);
