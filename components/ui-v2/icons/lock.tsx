import { createIcon } from './icon-base';

/**
 * Lock glyph: a soft padlock body under an arched shackle, with a keyhole.
 * For locked, private and secure.
 *
 * @example
 * ```tsx
 * <LockIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/lock
 */
export const LockIcon = createIcon(
  'LockIcon',
  'glyph',
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="4" />
    <path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5v2" />
  </>,
);
