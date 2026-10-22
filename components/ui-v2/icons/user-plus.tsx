import { createIcon } from './icon-base';

/**
 * User plus glyph: the User figure with a plus to its right. For adding a person.
 *
 * @example
 * ```tsx
 * <UserPlusIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/user-plus
 */
export const UserPlusIcon = createIcon(
  'UserPlusIcon',
  'glyph',
  <>
    <circle cx="9" cy="7" r="3" />
    <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20" />
    <path d="M18.5 8v5M16 10.5h5" />
  </>,
);
