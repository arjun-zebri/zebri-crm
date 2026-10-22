import { createIcon } from './icon-base';

/**
 * Receipt glyph: a soft slip with a zigzag torn bottom and three lines. For a receipt or proof of payment.
 *
 * @example
 * ```tsx
 * <ReceiptIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/receipt
 */
export const ReceiptIcon = createIcon(
  'ReceiptIcon',
  'glyph',
  <>
    <path d="M4 21V6.5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4V21l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
    <path d="M8 7.5h8M8 11h8M8 14.5h4" />
  </>,
);
