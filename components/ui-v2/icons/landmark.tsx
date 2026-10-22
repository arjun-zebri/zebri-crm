import { createIcon } from './icon-base';

/**
 * Landmark glyph: a pediment roof over four columns on a base. For an institution, bank or civic venue.
 *
 * @example
 * ```tsx
 * <LandmarkIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/landmark
 */
export const LandmarkIcon = createIcon(
  'LandmarkIcon',
  'glyph',
  <>
    <path d="M3.5 9 12 3.5 20.5 9z" />
    <path d="M6 11.5V18M10 11.5V18M14 11.5V18M18 11.5V18" />
    <path d="M3.5 20.5h17" />
  </>,
);
