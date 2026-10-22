import { createIcon } from './icon-base';

/**
 * Case Sensitive glyph: an upper and a lower case A (Aa). For match case or letter case.
 *
 * @example
 * ```tsx
 * <CaseSensitiveIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/case-sensitive
 */
export const CaseSensitiveIcon = createIcon(
  'CaseSensitiveIcon',
  'glyph',
  <>
    <path d="M3 17.5 7 6.5l4 11M4.5 13.5h5" />
    <circle cx="17.5" cy="14.5" r="3" />
    <path d="M20.5 11.5v6" />
  </>,
);
