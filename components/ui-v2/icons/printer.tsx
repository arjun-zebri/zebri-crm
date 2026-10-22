import { createIcon } from './icon-base';

/**
 * Printer glyph: a soft body with a sheet feeding in at the top and a printed sheet out the front. For printing.
 *
 * @example
 * ```tsx
 * <PrinterIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/printer
 */
export const PrinterIcon = createIcon(
  'PrinterIcon',
  'glyph',
  <>
    <path d="M6.5 17a4 4 0 0 1-4-4v-1a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4" />
    <path d="M6.5 8V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3" />
    <rect x="6.5" y="13.5" width="11" height="7.5" rx="1.5" />
  </>,
);
