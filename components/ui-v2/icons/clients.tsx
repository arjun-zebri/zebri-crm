import { createIcon } from './icon-base';

/**
 * Clients glyph: two arched figures side by side, the same arch as
 * HomeIcon, for the couples an MC works with. For the Clients
 * page and anything that opens a client.
 *
 * @example
 * ```tsx
 * <ClientsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/clients
 */
export const ClientsIcon = createIcon(
  'ClientsIcon',
  'glyph',
  <>
    <circle cx="7" cy="7.5" r="2.5" />
    <path d="M3.5 20.5V17.5a3.5 3.5 0 0 1 7 0v3" />
    <circle cx="17" cy="7.5" r="2.5" />
    <path d="M13.5 20.5V17.5a3.5 3.5 0 0 1 7 0v3" />
  </>,
);
