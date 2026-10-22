import { createIcon } from './icon-base';

/**
 * Package glyph: a soft cube, a box seen from above, for the package a
 * client chose. The outline is computed, not hand-placed: each corner of
 * the hexagon is rounded with a quadratic curve 1.5 along its edges, and
 * the points rounded to 2 decimals.
 *
 * @example
 * ```tsx
 * <PackageIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/package
 */
export const PackageIcon = createIcon(
  'PackageIcon',
  'glyph',
  <>
    <path d="M10.69 3.74Q12 3 13.31 3.74L18.69 6.76Q20 7.5 20 9L20 15Q20 16.5 18.69 17.24L13.31 20.26Q12 21 10.69 20.26L5.31 17.24Q4 16.5 4 15L4 9Q4 7.5 5.31 6.76Z" />
    <path d="M5.5 8.4 12 12l6.5-3.6M12 12v8" />
  </>,
);
