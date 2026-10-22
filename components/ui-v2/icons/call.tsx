import { createIcon } from './icon-base';

/**
 * Call glyph: a soft video camera, body and lens: a video call with a client. For the profile's Calls section, and anywhere a video call is meant.
 *
 * @example
 * ```tsx
 * <CallIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/call
 */
export const CallIcon = createIcon(
  'CallIcon',
  'glyph',
  <>
    <rect x="2.5" y="6" width="13" height="12" rx="4" />
    <path d="M15.5 10.5 20 8v8l-4.5-2.5" />
  </>,
);
