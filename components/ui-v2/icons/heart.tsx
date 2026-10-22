import { createIcon } from './icon-base';

/**
 * Heart glyph: a soft heart. For likes, favourites and the couple.
 *
 * @example
 * ```tsx
 * <HeartIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/heart
 */
export const HeartIcon = createIcon(
  'HeartIcon',
  'glyph',
  <>
    <path d="M12 20s-8.5-5-8.5-11a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11-8.5 11z" />
  </>,
);
