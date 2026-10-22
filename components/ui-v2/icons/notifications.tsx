import { createIcon } from './icon-base';

/**
 * Notifications glyph: a short, wide, round bell with an arc clapper.
 * For notifications and anything that lists what is new.
 *
 * @example
 * ```tsx
 * <NotificationsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/notifications
 */
export const NotificationsIcon = createIcon(
  'NotificationsIcon',
  'glyph',
  <>
    <path d="M4 15c1.5-.75 2-2.5 2-4.5v-1a6 6 0 0 1 12 0v1c0 2 .5 3.75 2 4.5z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </>,
);
