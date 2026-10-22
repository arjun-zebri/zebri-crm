import { createIcon } from './icon-base';

/**
 * Brush glyph: a slanted handle with a soft end and a rounded tuft of bristles. For brush or style tools.
 *
 * @example
 * ```tsx
 * <BrushIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/brush
 */
export const BrushIcon = createIcon(
  'BrushIcon',
  'glyph',
  <>
    <path d="M11 11l7.5-7.5a1.5 1.5 0 0 1 2 2L13 13z" />
    <path d="M9.5 13.5c-2 0-3.5 1.5-3.5 3.5 0 1.5-1 2.5-2.5 3 1 .5 2.5 1 3.5 1 2.5 0 4.5-2 4.5-4.5 0-1.5-.5-2.5-2-3z" />
  </>,
);
