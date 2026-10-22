import { createIcon } from './icon-base';

/**
 * User glyph: one person, the Clients head and arch drawn larger. For a single person or account.
 *
 * @example
 * ```tsx
 * <UserIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/user
 */
export const UserIcon = createIcon(
  'UserIcon',
  'glyph',
  <>
    <circle cx="12" cy="7" r="3" />
    <path d="M6.5 20v-1.5a5.5 5.5 0 0 1 11 0V20" />
  </>,
);
