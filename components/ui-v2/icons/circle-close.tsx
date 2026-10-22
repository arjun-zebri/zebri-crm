import { createIcon } from './icon-base';

/**
 * Circle close glyph: a cross in a circle. For failed, cancelled and clearing a
 * value.
 *
 * @example
 * ```tsx
 * <CircleCloseIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/circle-close
 */
export const CircleCloseIcon = createIcon(
  'CircleCloseIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </>,
);
