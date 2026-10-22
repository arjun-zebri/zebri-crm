import { createIcon } from './icon-base';

/**
 * Radius glyph: a square with tight corners except the top-right, drawn apart as one wide arc. For corner radius controls. The plain corners use rx 1.5 on purpose so the wide one stands out.
 *
 * @example
 * ```tsx
 * <RadiusIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/radius
 */
export const RadiusIcon = createIcon(
  'RadiusIcon',
  'glyph',
  <>
    <path d="M20.5 15v4a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5h4" />
    <path d="M20.5 11.5a8 8 0 0 0-8-8" />
  </>,
);
