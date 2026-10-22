import { createIcon } from './icon-base';

/**
 * Circle dot glyph: a small solid dot in a circle. For a selected option or an
 * active status.
 *
 * @example
 * ```tsx
 * <CircleDotIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/circle-dot
 */
export const CircleDotIcon = createIcon(
  'CircleDotIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="1" />
  </>,
);
