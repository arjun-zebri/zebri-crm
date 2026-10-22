import { createIcon } from './icon-base';

/**
 * Text alignment glyphs: four lines, long and short in turn, set left,
 * centre or right. Drawn as one family; the long lines are identical so
 * only the short ones move.
 *
 * @example
 * ```tsx
 * <AlignLeftIcon className="size-4" />
 * <AlignCenterIcon className="size-4" />
 * <AlignRightIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/align-text
 */

/** Text aligned left. */
export const AlignLeftIcon = createIcon(
  'AlignLeftIcon',
  'glyph',
  <>
    <path d="M4.5 6h15M4.5 10h10M4.5 14h15M4.5 18h10" />
  </>,
);

/** Text centred. */
export const AlignCenterIcon = createIcon(
  'AlignCenterIcon',
  'glyph',
  <>
    <path d="M4.5 6h15M7 10h10M4.5 14h15M7 18h10" />
  </>,
);

/** Text aligned right. */
export const AlignRightIcon = createIcon(
  'AlignRightIcon',
  'glyph',
  <>
    <path d="M4.5 6h15M9.5 10h10M4.5 14h15M9.5 18h10" />
  </>,
);
