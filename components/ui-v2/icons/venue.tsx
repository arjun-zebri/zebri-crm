import { createIcon } from './icon-base';

/**
 * Venue glyph: a soft map pin with a round centre: where the event is held. For the Venue row on a client's Overview.
 *
 * @example
 * ```tsx
 * <VenueIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/venue
 */
export const VenueIcon = createIcon(
  'VenueIcon',
  'glyph',
  <>
    <path d="M12 21.5s-7-6-7-11.5a7 7 0 0 1 14 0c0 5.5-7 11.5-7 11.5z" />
    <circle cx="12" cy="10" r="2.5" />
  </>,
);
