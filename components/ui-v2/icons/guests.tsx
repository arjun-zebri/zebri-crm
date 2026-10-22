import { createIcon } from './icon-base';

/**
 * Guests glyph: a crowd, one figure in front and two smaller behind: how many guests are coming. For the Guests row on a client's Overview.
 *
 * @example
 * ```tsx
 * <GuestsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/guests
 */
export const GuestsIcon = createIcon(
  'GuestsIcon',
  'glyph',
  <>
    <circle cx="12" cy="7" r="2.5" />
    <path d="M8 19.5V17a4 4 0 0 1 8 0v2.5" />
    <circle cx="5.5" cy="9" r="1.5" />
    <circle cx="18.5" cy="9" r="1.5" />
    <path d="M2.5 19.5v-2a3 3 0 0 1 3-3M21.5 19.5v-2a3 3 0 0 0-3-3" />
  </>,
);
