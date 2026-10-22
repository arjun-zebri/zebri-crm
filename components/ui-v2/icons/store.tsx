import { createIcon } from './icon-base';

/**
 * Store glyph: a scalloped awning over a soft shopfront with a door. For a shop, supplier or vendor.
 *
 * @example
 * ```tsx
 * <StoreIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/store
 */
export const StoreIcon = createIcon(
  'StoreIcon',
  'glyph',
  <>
    <path d="M3 7.5 5 3.5h14l2 4a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
    <path d="M5 12v4.5a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V12" />
    <path d="M10 20.5V18a2 2 0 0 1 4 0v2.5" />
  </>,
);
