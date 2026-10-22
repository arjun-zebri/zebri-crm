import { createIcon } from './icon-base';

/**
 * Connect glyph: a rounded plug, a soft cup under two prongs, with its
 * cord, drawn about as wide as the other glyphs so a Connect button
 * spaces like the rest. For connecting an outside account, such as the Connect button on
 * the Google Calendar and Outlook rows.
 *
 * @example
 * ```tsx
 * <ConnectIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/connect
 */
export const ConnectIcon = createIcon(
  'ConnectIcon',
  'glyph',
  <>
    <path d="M9 3.5v4.5M15 3.5v4.5" />
    <path d="M5 8h14v1.5a7 7 0 0 1-14 0z" />
    <path d="M12 16.5v4" />
  </>,
);
