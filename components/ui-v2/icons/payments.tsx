import { createIcon } from './icon-base';

/**
 * Payments glyph: a soft card with its number in the Soft dot motif,
 * three dots then the last digits. For the Payments page and anything
 * that takes or shows a payment.
 *
 * @example
 * ```tsx
 * <PaymentsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/payments
 */
export const PaymentsIcon = createIcon(
  'PaymentsIcon',
  'glyph',
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="4" />
    <path d="M6.5 14.5h0M9.5 14.5h0M12.5 14.5h0M15.5 14.5h2" />
  </>,
);
