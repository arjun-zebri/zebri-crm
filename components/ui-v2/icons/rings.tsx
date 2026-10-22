import { createIcon } from './icon-base';

/**
 * Rings glyph: two wedding rings, linked. For a marriage itself, such as
 * an earlier one on the couple's BDM form (user, 2026-10-15); the heart
 * is the wedding day, the rings the marriage.
 *
 * @example
 * ```tsx
 * <RingsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/rings
 */
export const RingsIcon = createIcon(
  'RingsIcon',
  'glyph',
  <>
    <circle cx="9" cy="12" r="5.5" />
    <circle cx="15" cy="12" r="5.5" />
  </>,
);
