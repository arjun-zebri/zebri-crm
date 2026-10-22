import { createIcon } from './icon-base';

/**
 * Wedding day glyph: a soft heart with a round point. For the event itself, the marker on a journey.
 *
 * @example
 * ```tsx
 * <WeddingDayIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/wedding-day
 */
export const WeddingDayIcon = createIcon(
  'WeddingDayIcon',
  'glyph',
  <>
    <path d="M12 19.5s-7.5-4.5-7.5-10a4 4 0 0 1 7.5-2 4 4 0 0 1 7.5 2c0 5.5-7.5 10-7.5 10z" />
  </>,
);
