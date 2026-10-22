import { createIcon } from './icon-base';

/**
 * Account manager glyph: a person with a speech bubble at their
 * shoulder, someone of your own to talk to. For a dedicated account
 * manager or a named contact at Zebri.
 *
 * @example
 * ```tsx
 * <AccountManagerIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/account-manager
 */
export const AccountManagerIcon = createIcon(
  'AccountManagerIcon',
  'glyph',
  <>
    <circle cx="9" cy="8.5" r="2.5" />
    <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />
    <path d="M16 4h3a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 19 9h-1.5L16 10.5V9a1.5 1.5 0 0 1-1.5-1.5v-2A1.5 1.5 0 0 1 16 4z" />
  </>,
);
