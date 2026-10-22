import { createIcon } from './icon-base';

/**
 * Circle check glyph: a tick in a circle. For complete and success states.
 *
 * @example
 * ```tsx
 * <CircleCheckIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/circle-check
 */
export const CircleCheckIcon = createIcon(
  'CircleCheckIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12l2.5 2.5 5-5" />
  </>,
);
