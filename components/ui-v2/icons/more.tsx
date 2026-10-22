import { createIcon } from './icon-base';

/**
 * More glyph: three heavy dots in a row (small rings, as in DragIcon, so they
 * hold weight at 14px). For an overflow
 * menu of more actions.
 *
 * @example
 * ```tsx
 * <MoreIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/more
 */
export const MoreIcon = createIcon(
  'MoreIcon',
  'glyph',
  <>
    <circle cx="6" cy="12" r=".75" />
    <circle cx="12" cy="12" r=".75" />
    <circle cx="18" cy="12" r=".75" />
  </>,
);
