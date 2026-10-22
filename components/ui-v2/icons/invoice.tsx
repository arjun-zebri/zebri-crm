import { createIcon } from './icon-base';

/**
 * Invoice glyph: a soft page with a short title, two line items with their amounts as dots, and a total. For invoices.
 *
 * @example
 * ```tsx
 * <InvoiceIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/invoice
 */
export const InvoiceIcon = createIcon(
  'InvoiceIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 7h3.5" />
    <path d="M8.5 11h4M15.5 11h0M8.5 14.5h4M15.5 14.5h0" />
    <path d="M12.5 18h3" />
  </>,
);
