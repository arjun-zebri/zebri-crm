import { createIcon } from './icon-base';

/**
 * Rectangle glyph: a plain wide soft rectangle. For a landscape shape or aspect.
 *
 * @example
 * ```tsx
 * <RectangleIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/rectangle
 */
export const RectangleIcon = createIcon(
  'RectangleIcon',
  'glyph',
  <>
    <rect x="3" y="6" width="18" height="12" rx="4" />
  </>,
);
