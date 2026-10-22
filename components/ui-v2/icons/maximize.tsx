import { createIcon } from './icon-base';

/**
 * Maximize glyph: four soft corners framing a square. For full screen or
 * opening something larger.
 *
 * @example
 * ```tsx
 * <MaximizeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/maximize
 */
export const MaximizeIcon = createIcon(
  'MaximizeIcon',
  'glyph',
  <>
    <path d="M9 4H7a3 3 0 0 0-3 3v2M15 4h2a3 3 0 0 1 3 3v2M20 15v2a3 3 0 0 1-3 3h-2M4 15v2a3 3 0 0 0 3 3h2" />
  </>,
);
