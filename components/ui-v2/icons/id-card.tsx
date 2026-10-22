import { createIcon } from './icon-base';

/**
 * ID card glyph: a landscape soft card with a portrait (head and
 * shoulders) on the left and two lines of text on the right. For the ID
 * someone shows, on the couple's BDM form (user, 2026-10-15: a file with a
 * tick did not say ID).
 *
 * @example
 * ```tsx
 * <IdCardIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/id-card
 */
export const IdCardIcon = createIcon(
  'IdCardIcon',
  'glyph',
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="4" />
    <circle cx="8.5" cy="10.5" r="2" />
    <path d="M5.5 16a3 3 0 0 1 6 0" />
    <path d="M14 10.5h4M14 14h2.5" />
  </>,
);
