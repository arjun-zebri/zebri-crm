import { createIcon } from './icon-base';

/**
 * Star glyph: a five-point star with softened tips. The outline is computed
 * (each outer point rounded by a quadratic 1.5 back along both edges, rounded
 * to 2 decimals), so its coordinates are off the half-unit grid by design.
 * For favourites and ratings.
 *
 * @example
 * ```tsx
 * <StarIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/star
 */
export const StarIcon = createIcon(
  'StarIcon',
  'glyph',
  <>
    <path d="M11.38 4.77Q12 3.41 12.62 4.77L14.65 9.27L19.54 9.81Q21.04 9.97 19.93 10.98L16.28 14.3L17.28 19.12Q17.58 20.59 16.28 19.85L12 17.41L7.72 19.85Q6.42 20.59 6.72 19.12L7.72 14.3L4.07 10.98Q2.96 9.97 4.46 9.81L9.35 9.27z" />
  </>,
);
