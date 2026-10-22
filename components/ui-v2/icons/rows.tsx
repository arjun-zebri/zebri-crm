import { createIcon } from './icon-base';

/**
 * Rows glyph: a soft square split into three rows.
 *
 * @example
 * ```tsx
 * <RowsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/rows
 */
export const RowsIcon = createIcon(
  'RowsIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M3.5 9h17M3.5 15h17" />
  </>,
);
