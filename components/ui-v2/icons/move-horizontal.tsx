import { createIcon } from './icon-base';

/**
 * Move horizontal glyph: a line with an arrowhead at each end, left and right. For
 * resizing or moving something sideways.
 *
 * @example
 * ```tsx
 * <MoveHorizontalIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/move-horizontal
 */
export const MoveHorizontalIcon = createIcon(
  'MoveHorizontalIcon',
  'glyph',
  <>
    <path d="M3 12h18M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5" />
  </>,
);
