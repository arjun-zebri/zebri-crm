import { createIcon } from './icon-base';

/**
 * Accept glyph: a soft square holding a tick. For where a client says yes.
 *
 * @example
 * ```tsx
 * <AcceptIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/accept
 */
export const AcceptIcon = createIcon(
  'AcceptIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M8 12.25l2.75 2.75L16 9.5" />
  </>,
);
