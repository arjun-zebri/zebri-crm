import { createIcon } from './icon-base';

/**
 * Square glyph: a plain soft square. For a square shape or aspect.
 *
 * @example
 * ```tsx
 * <SquareIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/square
 */
export const SquareIcon = createIcon(
  'SquareIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
  </>,
);
